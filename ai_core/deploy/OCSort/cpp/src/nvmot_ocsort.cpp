/*
 * NvMOT (Nvidia Multi-Object Tracker) Wrapper for OCSort C++
 * This API complies with the DeepStream 7.0 nvtracker standard.
 * Fixed for DS 7.0: namespace, NvMOTRect field names, NvMOTFrame API changes.
 */

#include "nvdstracker.h"
#include <iostream>
#include <vector>
#include <memory>
#include <map>
#include "OCSort.hpp" // Your original header file

using namespace ocsort;

// A context class managing Trackers for multiple camera streams (Multi-stream)
class NvMOTContext {
public:
    std::map<uint64_t, std::unique_ptr<OCSort>> stream_trackers;
    float det_thresh = 0.3f;
    float iou_thresh = 0.3f;
};

// 1. Initialize Tracker
extern "C" NvMOTStatus NvMOT_Init(NvMOTConfig *pConfigIn, NvMOTContextHandle *pContextHandle, NvMOTConfigResponse *pConfigResponse) {
    if (!pContextHandle || !pConfigIn || !pConfigResponse) {
        return NvMOTStatus_Error;
    }

    // Create shared Context
    NvMOTContext* context = new NvMOTContext();

    // Read configuration parameters from nvtracker txt file (if there is a custom config)
    if (pConfigIn->customConfigFilePath) {
        std::cout << "[OCSort NvMOT] Loading config from: " << pConfigIn->customConfigFilePath << std::endl;
        // Todo: Parse yaml config if needed
    }

    *pContextHandle = (NvMOTContextHandle)context;

    std::cout << "[OCSort NvMOT] Successfully initialized OCSort C++ Backend!" << std::endl;
    return NvMOTStatus_OK;
}

// 2. Run Tracker whenever new BBox arrives
extern "C" NvMOTStatus NvMOT_Process(NvMOTContextHandle contextHandle, NvMOTProcessParams *pParams, NvMOTTrackedObjBatch *pTrackedObjectsBatch) {
    if (!contextHandle || !pParams || !pTrackedObjectsBatch) {
        return NvMOTStatus_Error;
    }

    NvMOTContext* context = (NvMOTContext*)contextHandle;

    // Iterate through each camera stream in the batch (if multi-camera)
    for (uint32_t stream_idx = 0; stream_idx < pParams->numFrames; stream_idx++) {
        NvMOTFrame* frame = &pParams->frameList[stream_idx];
        uint64_t stream_id = frame->streamID;

        // If this camera stream does not have an OCSort Tracker yet, create a new one
        if (context->stream_trackers.find(stream_id) == context->stream_trackers.end()) {
            // OCSort parameters: det_thresh, max_age, min_hits, iou_threshold
            context->stream_trackers[stream_id] = std::unique_ptr<OCSort>(new OCSort(context->det_thresh, 30, 3, context->iou_thresh));
        }

        OCSort* tracker = context->stream_trackers[stream_id].get();

        // Extract BBox from YOLOX (provided by nvinfer)
        // DS 7.0: objectsIn is NvMOTObjToTrackList with numAllocated + list[], not operator[]
        uint32_t num_dets = frame->objectsIn.numAllocated;
        // OCSort::update() expects Eigen::MatrixXf with shape [N, 7]
        Eigen::MatrixXf detections(num_dets, 7);
        for (uint32_t i = 0; i < num_dets; i++) {
            NvMOTObjToTrack* obj = &frame->objectsIn.list[i];
            // DS 7.0: NvMOTRect uses {x, y, width, height}
            float x1 = obj->bbox.x;
            float y1 = obj->bbox.y;
            float x2 = obj->bbox.x + obj->bbox.width;
            float y2 = obj->bbox.y + obj->bbox.height;
            // OCSort inputs: [x1, y1, x2, y2, score, class, ?]
            detections(i, 0) = x1;
            detections(i, 1) = y1;
            detections(i, 2) = x2;
            detections(i, 3) = y2;
            detections(i, 4) = obj->confidence;
            detections(i, 5) = (float)obj->classId;
            detections(i, 6) = 0.0f;
        }

        // Call C++ OCSort logic to assign IDs
        // Returns vector<RowVectorXf> where each row = [x1, y1, x2, y2, track_id, class, score]
        std::vector<Eigen::RowVectorXf> tracked_targets = tracker->update(detections);

        // Write results back to DeepStream
        NvMOTTrackedObjList* out_list = &pTrackedObjectsBatch->list[stream_idx];
        out_list->numAllocated = tracked_targets.size();
        out_list->numFilled = tracked_targets.size();
        out_list->streamID = stream_id;
        out_list->frameNum = frame->frameNum;

        for (size_t t = 0; t < tracked_targets.size(); t++) {
            const Eigen::RowVectorXf& trk = tracked_targets[t];
            NvMOTTrackedObj* out_obj = &out_list->list[t];

            out_obj->classId    = (int)trk(5);          // Class
            out_obj->trackingId = (uint64_t)trk(4);     // Track ID
            out_obj->confidence = trk(6);               // Score

            // DS 7.0: NvMOTRect uses {x, y, width, height}
            out_obj->bbox.x      = trk(0);
            out_obj->bbox.y      = trk(1);
            out_obj->bbox.width  = trk(2) - trk(0);
            out_obj->bbox.height = trk(3) - trk(1);
        }
    }

    return NvMOTStatus_OK;
}

// 3. Free memory
extern "C" void NvMOT_DeInit(NvMOTContextHandle contextHandle) {
    if (contextHandle) {
        NvMOTContext* context = (NvMOTContext*)contextHandle;
        delete context;
        std::cout << "[OCSort NvMOT] Successfully released Tracker memory!" << std::endl;
    }
}
