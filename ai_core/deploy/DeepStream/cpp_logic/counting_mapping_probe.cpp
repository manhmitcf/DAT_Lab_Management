/*
 * Counting and Mapping GStreamer Pad Probe
 * This code replaces the Python Overhead for Line Crossing and OpenCV Homography.
 */

#include <gst/gst.h>
#include <glib.h>
#include <iostream>
#include <vector>
#include <mutex>
#include <cmath>
#include <map>
#include <opencv2/calib3d.hpp>
#include <opencv2/core.hpp>

#include "nvdsmeta.h"
#include "gstnvdsmeta.h"
#include "nvdstracker.h"

// ----------------------------------------------------------------------------
// Shared Memory Settings (Mutex Protected for Thread Safety from Python changes)
// ----------------------------------------------------------------------------
std::mutex settings_mutex;

// Custom Meta struct for User Meta
extern "C" {
    struct CustomMappingData {
        float map_x;
        float map_y;
    };
    
    gpointer copy_custom_mapping_meta(gpointer data, gpointer user_data) {
        CustomMappingData *src = (CustomMappingData *)data;
        CustomMappingData *dst = new CustomMappingData;
        *dst = *src;
        return dst;
    }

    void release_custom_mapping_meta(gpointer data, gpointer user_data) {
        CustomMappingData *meta = (CustomMappingData *)data;
        delete meta;
    }
}
#define NVDS_CUSTOM_MAPPING_META (NvDsMetaType)(nvds_get_user_meta_type("NVDS.CUSTOM.MAPPING.META"))

struct Point2f {
    float x, y;
};

// Counting Configuration
Point2f line_start = {0, 0};
Point2f line_end = {0, 0};
Point2f inside_point = {0, 0};
float crossing_margin = 10.0f;
int count_in = 0;
int count_out = 0;

// Internal counting state
std::map<uint64_t, std::string> object_states;
Point2f line_vector;
Point2f normal_vector;
int in_sign = 1;

// Mapping Configuration
cv::Mat homography_matrix;
bool is_mapping_ready = false;
int map_w_runtime = 723;
int map_h_runtime = 1266;

// ----------------------------------------------------------------------------
// Step 3.1 & 3.4: Counting Logic Updates
// ----------------------------------------------------------------------------
extern "C" void update_counting_config(float start_x, float start_y, float end_x, float end_y, float inside_x, float inside_y, float margin) {
    std::lock_guard<std::mutex> lock(settings_mutex);
    line_start = {start_x, start_y};
    line_end = {end_x, end_y};
    inside_point = {inside_x, inside_y};
    crossing_margin = margin;

    line_vector = {line_end.x - line_start.x, line_end.y - line_start.y};
    float line_length = std::sqrt(line_vector.x * line_vector.x + line_vector.y * line_vector.y);
    if (line_length > 0) {
        Point2f unit_line = {line_vector.x / line_length, line_vector.y / line_length};
        normal_vector = {-unit_line.y, unit_line.x};

        float inside_dist = (inside_point.x - line_start.x) * normal_vector.x + (inside_point.y - line_start.y) * normal_vector.y;
        in_sign = (inside_dist > 0) ? 1 : -1;
    }
    object_states.clear(); // Reset states on new line
    std::cout << "[C++ Probe] Counting settings updated." << std::endl;
}

// ----------------------------------------------------------------------------
// Step 3.2 & 3.4: Mapping Logic Updates
// ----------------------------------------------------------------------------
extern "C" void update_mapping_config(float* cam_pts, float* map_pts, int num_pts, int map_w, int map_h) {
    std::lock_guard<std::mutex> lock(settings_mutex);
    if (num_pts < 4) return;

    std::vector<cv::Point2f> src_pts, dst_pts;
    for (int i = 0; i < num_pts; ++i) {
        src_pts.push_back(cv::Point2f(cam_pts[i*2], cam_pts[i*2+1]));
        dst_pts.push_back(cv::Point2f(map_pts[i*2], map_pts[i*2+1]));
    }

    homography_matrix = cv::findHomography(src_pts, dst_pts, cv::RANSAC, 5.0);
    if (!homography_matrix.empty()) {
        is_mapping_ready = true;
        map_w_runtime = map_w;
        map_h_runtime = map_h;
        std::cout << "[C++ Probe] Mapping matrix updated successfully." << std::endl;
    }
}

// ----------------------------------------------------------------------------
// Fetch Results for Python (Thread Safe)
// ----------------------------------------------------------------------------
extern "C" void get_current_counts(int* in_cnt, int* out_cnt) {
    std::lock_guard<std::mutex> lock(settings_mutex);
    *in_cnt = count_in;
    *out_cnt = count_out;
}

// ----------------------------------------------------------------------------
// Step 3.3: GStreamer Pad Probe
// ----------------------------------------------------------------------------
extern "C" GstPadProbeReturn cpp_logic_pad_buffer_probe(GstPad *pad, GstPadProbeInfo *info, gpointer u_data) {
    GstBuffer *buf = (GstBuffer *) info->data;
    NvDsBatchMeta *batch_meta = gst_buffer_get_nvds_batch_meta(buf);
    if (!batch_meta) return GST_PAD_PROBE_OK;

    std::lock_guard<std::mutex> lock(settings_mutex);

    for (NvDsMetaList *l_frame = batch_meta->frame_meta_list; l_frame != NULL; l_frame = l_frame->next) {
        NvDsFrameMeta *frame_meta = (NvDsFrameMeta *) (l_frame->data);

        for (NvDsMetaList *l_obj = frame_meta->obj_meta_list; l_obj != NULL; l_obj = l_obj->next) {
            NvDsObjectMeta *obj_meta = (NvDsObjectMeta *) (l_obj->data);

            // Only process tracked objects (id > 0)
            if (obj_meta->object_id == UNTRACKED_OBJECT_ID) continue;

            // Calculate bottom-center for feet position
            float cx = obj_meta->rect_params.left + (obj_meta->rect_params.width / 2.0f);
            float cy = obj_meta->rect_params.top + obj_meta->rect_params.height;

            // --- 1. COUNTING LOGIC ---
            float current_distance = (cx - line_start.x) * normal_vector.x + (cy - line_start.y) * normal_vector.y;
            float relative_dist = current_distance * in_sign;

            std::string current_state = "none";
            if (relative_dist > crossing_margin) current_state = "inside";
            else if (relative_dist < -crossing_margin) current_state = "outside";

            if (current_state != "none") {
                uint64_t tid = obj_meta->object_id;
                if (object_states.find(tid) == object_states.end()) {
                    object_states[tid] = current_state;
                } else {
                    std::string prev_state = object_states[tid];
                    if (prev_state == "outside" && current_state == "inside") {
                        count_in++;
                        object_states[tid] = "inside";
                    } else if (prev_state == "inside" && current_state == "outside") {
                        count_out++;
                        object_states[tid] = "outside";
                    }
                }
            }

            // --- 2. MAPPING LOGIC ---
            // (Note: To pass custom data back to python, we can format a string and append to text_params)
            if (is_mapping_ready) {
                std::vector<cv::Point2f> src_pts = { cv::Point2f(cx, cy) };
                std::vector<cv::Point2f> dst_pts;
                cv::perspectiveTransform(src_pts, dst_pts, homography_matrix);

                // Add Map Coordinates to OSD text so python or screen can see it
                char map_text[64];
                snprintf(map_text, sizeof(map_text), " [2D: %.1f, %.1f]", dst_pts[0].x, dst_pts[0].y);

                // Modify object display text
                if (obj_meta->text_params.display_text) {
                    std::string new_text = std::string(obj_meta->text_params.display_text) + map_text;
                    g_free(obj_meta->text_params.display_text);
                    obj_meta->text_params.display_text = g_strdup(new_text.c_str());
                }

                // --- INJECT NvDsUserMeta ---
                NvDsUserMeta *user_meta = nvds_acquire_user_meta_from_pool(batch_meta);
                if (user_meta) {
                    CustomMappingData *meta_data = new CustomMappingData;
                    meta_data->map_x = dst_pts[0].x;
                    meta_data->map_y = dst_pts[0].y;
                    
                    user_meta->user_meta_data = (void *)meta_data;
                    user_meta->base_meta.meta_type = NVDS_CUSTOM_MAPPING_META;
                    user_meta->base_meta.copy_func = (NvDsMetaCopyFunc)copy_custom_mapping_meta;
                    user_meta->base_meta.release_func = (NvDsMetaReleaseFunc)release_custom_mapping_meta;
                    
                    nvds_add_user_meta_to_obj(obj_meta, user_meta);
                }
            }
        }
    }
    return GST_PAD_PROBE_OK;
}

// Helper to attach the probe from Python via ctypes
extern "C" void attach_cpp_probe_to_pad(gpointer pad_ptr) {
    if (!pad_ptr) return;
    GstPad* pad = (GstPad*)pad_ptr;
    gst_pad_add_probe(pad, GST_PAD_PROBE_TYPE_BUFFER, cpp_logic_pad_buffer_probe, NULL, NULL);
}
