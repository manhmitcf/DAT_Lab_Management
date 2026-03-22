# Deployment Assets

This directory contains pre-compiled libraries and configuration files required for deploying the application in a DeepStream environment. These files are often specific to the target hardware (like a Jetson device).

## Directory Descriptions

-   **`DeepStream/`**
    -   **Purpose:** Holds configuration files and custom parser libraries for DeepStream plugins.
    -   **Key Files:**
        -   `config_infer_primary_yolox.txt`: The main configuration for the primary inference engine (`nvinfer`), telling it which model to use (YOLOX), batch size, etc.
        -   `config_tracker_ocsort.txt`: The configuration for the object tracker (`nvtracker`), specifying parameters for the OCSort algorithm.
        -   `libnvdsinfer_custom_impl_YoloX.so`: A custom-built shared library needed to parse the output of the YOLOX model.

-   **`OCSort/`**
    -   **Purpose:** Contains the source code and compiled library for the OCSort tracking algorithm.
    -   **Key Files:**
        -   `cpp/build/libnvds_ocsort.so`: The compiled C++ shared library that integrates the OCSort algorithm into DeepStream's `nvtracker` plugin. This provides high-performance object tracking.
