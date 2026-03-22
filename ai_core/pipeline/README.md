# Pipeline Logic

This directory contains Python modules that are directly related to the setup and data extraction from the GStreamer pipeline.

## File Descriptions

-   **`model_converter.py`**
    -   **Purpose:** Handles the conversion of the AI model into a format optimized for NVIDIA GPUs.
    -   **Details:** It contains a function (`check_and_convert_models`) that checks if a TensorRT `.engine` file exists. If not, it converts the original model (e.g., from `.onnx`) into a highly optimized TensorRT engine for faster inference.

-   **`osd_probe.py`**
    -   **Purpose:** Defines the logic for extracting data from the pipeline.
    -   **Details:** The `OSDProbeHandler` class contains the main callback function (`osd_sink_pad_buffer_probe`). This function is attached as a "probe" to a pad in the GStreamer pipeline. It reads the metadata buffer for each frame, extracts object details (like ID and position), formats the data into JSON, and puts it into a queue for further processing (e.g., sending to a backend).
