/*
 * Copyright (c) 2019-2021, NVIDIA CORPORATION. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstring>
#include <iostream>
#include <vector>
#include "nvdsinfer_custom_impl.h"

#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define MAX(a, b) ((a) > (b) ? (a) : (b))

// Standard input size for YOLOX (e.g. 640x640)
static const int INPUT_W = 640;
static const int INPUT_H = 640;

// YOLOX Grid / Strides
static const int STRIDES[] = {8, 16, 32};
static const int NUM_CLASSES = 1; // Number of classes (here considered only detecting person = 1 class)

extern "C" bool NvDsInferParseYoloX(
    std::vector<NvDsInferLayerInfo> const& outputLayersInfo,
    NvDsInferNetworkInfo const& networkInfo,
    NvDsInferParseDetectionParams const& detectionParams,
    std::vector<NvDsInferParseObjectInfo>& objectList);

static std::vector<int> generate_grids_and_stride(int target_w, int target_h, std::vector<int>& strides)
{
    std::vector<int> grid_strides;
    for (auto stride : strides)
    {
        int num_grid_w = target_w / stride;
        int num_grid_h = target_h / stride;
        for (int g1 = 0; g1 < num_grid_h; g1++)
        {
            for (int g0 = 0; g0 < num_grid_w; g0++)
            {
                grid_strides.push_back(g0);
                grid_strides.push_back(g1);
                grid_strides.push_back(stride);
            }
        }
    }
    return grid_strides;
}

// Custom parser for YOLOX tensor
extern "C" bool NvDsInferParseYoloX(
    std::vector<NvDsInferLayerInfo> const& outputLayersInfo,
    NvDsInferNetworkInfo const& networkInfo,
    NvDsInferParseDetectionParams const& detectionParams,
    std::vector<NvDsInferParseObjectInfo>& objectList)
{
    if (outputLayersInfo.empty()) {
        std::cerr << "ERROR: Could not find output layer in bbox parsing" << std::endl;
        return false;
    }

    // Default output layer is usually "output"
    const NvDsInferLayerInfo& output = outputLayersInfo[0];
    float* output_data = (float*)output.buffer;

    // Calculate number of anchors based on grid sizes
    std::vector<int> strides = {8, 16, 32};
    std::vector<int> grid_strides = generate_grids_and_stride(INPUT_W, INPUT_H, strides);
    int num_anchors = grid_strides.size() / 3;

    // YOLOX outputs tensor with shape: (1, num_anchors, 5 + num_classes)
    // Structure of each element: [cx, cy, w, h, obj_conf, class_conf1, ...]

    for (int i = 0; i < num_anchors; ++i)
    {
        float obj_conf = output_data[i * (5 + NUM_CLASSES) + 4];
        if (obj_conf < detectionParams.perClassPreclusterThreshold[0]) continue;

        // Find the class with the highest probability
        int max_class_idx = -1;
        float max_class_prob = -1.0;
        for (int c = 0; c < NUM_CLASSES; ++c)
        {
            float class_prob = output_data[i * (5 + NUM_CLASSES) + 5 + c];
            if (class_prob > max_class_prob)
            {
                max_class_idx = c;
                max_class_prob = class_prob;
            }
        }

        float score = obj_conf * max_class_prob;

        // Threshold check
        if (score > detectionParams.perClassPreclusterThreshold[0])
        {
            float cx = output_data[i * (5 + NUM_CLASSES) + 0];
            float cy = output_data[i * (5 + NUM_CLASSES) + 1];
            float w  = output_data[i * (5 + NUM_CLASSES) + 2];
            float h  = output_data[i * (5 + NUM_CLASSES) + 3];

            // Coordinates are in original form because decode_in_inference=False when exporting ONNX
            int grid0 = grid_strides[i * 3 + 0];
            int grid1 = grid_strides[i * 3 + 1];
            int stride = grid_strides[i * 3 + 2];

            cx = (cx + grid0) * stride;
            cy = (cy + grid1) * stride;
            w = std::exp(w) * stride;
            h = std::exp(h) * stride;

            float x1 = cx - w / 2.0f;
            float y1 = cy - h / 2.0f;

            // Clip coordinates
            x1 = std::max(0.0f, std::min(x1, (float)networkInfo.width - 1));
            y1 = std::max(0.0f, std::min(y1, (float)networkInfo.height - 1));
            float x2 = std::max(0.0f, std::min(x1 + w, (float)networkInfo.width - 1));
            float y2 = std::max(0.0f, std::min(y1 + h, (float)networkInfo.height - 1));

            NvDsInferParseObjectInfo obj;
            obj.left = x1;
            obj.top = y1;
            obj.width = x2 - x1;
            obj.height = y2 - y1;
            obj.classId = max_class_idx;
            obj.detectionConfidence = score;

            objectList.push_back(obj);
        }
    }

    return true;
}

// Mandatory macro for NvInfer to load function from shared library
CHECK_CUSTOM_PARSE_FUNC_PROTOTYPE(NvDsInferParseYoloX);
