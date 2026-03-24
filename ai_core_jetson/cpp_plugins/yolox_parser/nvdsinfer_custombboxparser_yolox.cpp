/*
 * DeepStream Custom Bounding Box Parser for YOLOX
 * Parses the (1, N, 85) output tensor from YOLOX (N = sum of anchor grids).
 * Performs Non-Maximum Suppression (NMS) and object clustering.
 * 
 * Config Injection Note:
 * The `detectionParams.perClassPreclusterThreshold` is loaded DYNAMICALLY by DeepStream 
 * from the config_infer.txt file. Our Python PipelineManager will automatically 
 * update config_infer.txt with the values from `tracking_config.json`, thereby 
 * ensuring single-source-of-truth configuration control from Python!
 */

#include <iostream>
#include <vector>
#include <cmath>
#include <algorithm>
#include "nvdsinfer_custom_impl.h"

// Define standard macros for visibility
#define EXPORT_CUSTOM_PARSER extern "C" __attribute__((visibility("default")))

namespace {

    // NMS Configuration
    // While det_thresh comes from detectionParams, NMS threshold is hard to pass cleanly
    // via basic nvinfer config. We define it as a constant but can be compiled via CMake -DNMS_THRESH.
    #ifndef YOLOX_NMS_THRESH
    #define YOLOX_NMS_THRESH 0.7
    #endif

    struct Bbox {
        float x1, y1, x2, y2, score;
        int class_id;
    };

    // Calculate Intersection over Union (IoU)
    float calculateIoU(const Bbox& a, const Bbox& b) {
        float inter_x1 = std::max(a.x1, b.x1);
        float inter_y1 = std::max(a.y1, b.y1);
        float inter_x2 = std::min(a.x2, b.x2);
        float inter_y2 = std::min(a.y2, b.y2);

        float inter_area = std::max(0.0f, inter_x2 - inter_x1) * std::max(0.0f, inter_y2 - inter_y1);
        if (inter_area == 0.0f) return 0.0f;

        float area_a = (a.x2 - a.x1) * (a.y2 - a.y1);
        float area_b = (b.x2 - b.x1) * (b.y2 - b.y1);

        return inter_area / (area_a + area_b - inter_area);
    }

    // Standard Non-Maximum Suppression (NMS)
    void nms(std::vector<Bbox>& boxes, float nms_thresh) {
        // Sort boxes by score in descending order
        std::sort(boxes.begin(), boxes.end(), [](const Bbox& a, const Bbox& b) {
            return a.score > b.score;
        });

        std::vector<bool> keep(boxes.size(), true);
        for (size_t i = 0; i < boxes.size(); ++i) {
            if (!keep[i]) continue;
            for (size_t j = i + 1; j < boxes.size(); ++j) {
                if (keep[j] && boxes[i].class_id == boxes[j].class_id) {
                    if (calculateIoU(boxes[i], boxes[j]) > nms_thresh) {
                        keep[j] = false;
                    }
                }
            }
        }

        // Remove suppressed boxes
        size_t keep_idx = 0;
        for (size_t i = 0; i < boxes.size(); ++i) {
            if (keep[i]) {
                boxes[keep_idx++] = boxes[i];
            }
        }
        boxes.resize(keep_idx);
    }
} // namespace

EXPORT_CUSTOM_PARSER bool NvDsInferParseCustomYOLOX(
    std::vector<NvDsInferLayerInfo> const& outputLayersInfo,
    NvDsInferNetworkInfo const& networkInfo,
    NvDsInferParseDetectionParams const& detectionParams,
    std::vector<NvDsInferParseObjectInfo>& objectList) 
{
    if (outputLayersInfo.empty()) {
        std::cerr << "[YOLOX Parser] Error: Missing output layer." << std::endl;
        return false;
    }

    // YOLOX usually outputs a single tensor with shape (1, 8400, 85) for 80 classes at 640x640
    // 85 = 4 (bbox center_x, center_y, w, h) + 1 (obj_conf) + 80 (class_conf)
    const NvDsInferLayerInfo& outputLayer = outputLayersInfo[0];
    const float* output_data = (const float*)outputLayer.buffer;
    
    // Calculate number of bounding box proposals based on dimensions
    // outputLayer.inferDims.d[0] usually represents N (e.g., 8400)
    // outputLayer.inferDims.d[1] usually represents 85
    int num_proposals = outputLayer.inferDims.d[0];
    int num_elements = outputLayer.inferDims.d[1];

    if (num_elements < 6) {
        std::cerr << "[YOLOX Parser] Error: Unexpected output dimensions." << std::endl;
        return false;
    }

    int num_classes = num_elements - 5;
    std::vector<Bbox> bboxes;

    // Threshold configured dynamically from nvinfer config (which Python generates)
    float global_det_thresh = detectionParams.perClassPreclusterThreshold[0]; 

    // Decode predictions
    for (int i = 0; i < num_proposals; ++i) {
        const float* row = output_data + i * num_elements;
        float obj_conf = row[4];

        if (obj_conf < global_det_thresh) continue;

        // Find max class confidence
        int max_class_id = -1;
        float max_class_conf = -1.0f;
        
        for (int c = 0; c < num_classes; ++c) {
            float class_conf = row[5 + c];
            if (class_conf > max_class_conf) {
                max_class_conf = class_conf;
                max_class_id = c;
            }
        }

        float final_score = obj_conf * max_class_conf;

        // Apply dynamically loaded threshold per class
        float class_thresh = detectionParams.perClassPreclusterThreshold[max_class_id];
        if (final_score > class_thresh) {
            float cx = row[0];
            float cy = row[1];
            float w = row[2];
            float h = row[3];

            // Convert to top-left and bottom-right
            float x1 = cx - w / 2.0f;
            float y1 = cy - h / 2.0f;
            float x2 = cx + w / 2.0f;
            float y2 = cy + h / 2.0f;

            // Clamp to image dimensions
            x1 = std::max(0.0f, std::min(x1, (float)networkInfo.width));
            y1 = std::max(0.0f, std::min(y1, (float)networkInfo.height));
            x2 = std::max(0.0f, std::min(x2, (float)networkInfo.width));
            y2 = std::max(0.0f, std::min(y2, (float)networkInfo.height));

            bboxes.push_back({x1, y1, x2, y2, final_score, max_class_id});
        }
    }

    // Apply NMS
    nms(bboxes, YOLOX_NMS_THRESH);

    // Convert to DeepStream Objects
    for (const auto& box : bboxes) {
        NvDsInferParseObjectInfo obj;
        obj.classId = box.class_id;
        obj.left = box.x1;
        obj.top = box.y1;
        obj.width = box.x2 - box.x1;
        obj.height = box.y2 - box.y1;
        obj.detectionConfidence = box.score;
        objectList.push_back(obj);
    }

    return true;
}

// Ensure the parser implementation is compliant
CHECK_CUSTOM_PARSE_FUNC_PROTOTYPE(NvDsInferParseCustomYOLOX);
