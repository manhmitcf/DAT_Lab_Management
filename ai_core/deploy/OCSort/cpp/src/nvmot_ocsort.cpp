/*
 * NvMOT (Nvidia Multi-Object Tracker) Wrapper for OCSort C++
 * This API complies with the DeepStream nvtracker standard.
 */

#include "nvdstracker.h"
#include <iostream>
#include <vector>
#include <memory>
#include <map>
#include "OCSort.hpp" // Your original header file

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

    // Request NvTracker to provide Batch Buffer (instead of discrete Frame mode)
    pConfigResponse->summaryType = NvMOT_Compute_Matching;
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
        std::vector<Eigen::Matrix<float, 1, 7>> detections;
        for (uint32_t i = 0; i < frame->numObjects; i++) {
            NvMOTObjToTrack* obj = &frame->objectsIn[i];

            Eigen::Matrix<float, 1, 7> det;
            // OCSort inputs: [x1, y1, x2, y2, score, class, ?]
            det << obj->bbox.left,
                   obj->bbox.top,
                   obj->bbox.left + obj->bbox.width,
                   obj->bbox.top + obj->bbox.height,
                   obj->confidence,
                   obj->classId,
                   0.0f;
            detections.push_back(det);
        }

        // Call C++ OCSort logic to assign IDs
        std::vector<Eigen::Matrix<float, 1, 7>> tracked_targets = tracker->update(detections);

        // Write results back to DeepStream
        NvMOTTrackedObjList* out_list = &pTrackedObjectsBatch->list[stream_idx];
        out_list->numAllocated = tracked_targets.size();
        out_list->numFilled = tracked_targets.size();
        out_list->streamID = stream_id;
        out_list->frameNum = frame->frameNum;

        // Allocate memory for output array if NvTracker hasn't allocated enough
        // (In NvTracker, we usually fill into pTrackedObjectsBatch->list[i]->list)
        for (size_t t = 0; t < tracked_targets.size(); t++) {
            auto trk = tracked_targets[t];
            NvMOTTrackedObj* out_obj = &out_list->list[t];

            out_obj->classId = (int)trk(0, 5); // Class
            out_obj->trackingId = (uint64_t)trk(0, 4); // Track ID
            out_obj->confidence = trk(0, 6); // Score

            out_obj->bbox.left = trk(0, 0);
            out_obj->bbox.top = trk(0, 1);
            out_obj->bbox.width = trk(0, 2) - trk(0, 0);
            out_obj->bbox.height = trk(0, 3) - trk(0, 1);
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
