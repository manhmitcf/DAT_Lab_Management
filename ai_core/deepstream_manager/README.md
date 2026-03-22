# DeepStream Manager Module

This directory contains the core logic for the DeepStream application, broken down into separate classes to make the code easier to manage and understand.

## File Descriptions

-   **`__init__.py`**
    -   An empty file that tells Python to treat this directory as a package.

-   **`main_app.py`**
    -   **Purpose:** This is the main orchestrator of the application.
    -   **Details:** The `DeepStreamApp` class in this file initializes and coordinates all the other manager classes. It holds the main application state and defines the callbacks that are used by other services.

-   **`diagnostics.py`**
    -   **Purpose:** Handles system checks before the application starts.
    -   **Details:** The `Diagnostics` class runs a "pre-flight check" to ensure that the camera is connected, all required files (models, configs) exist, and environment variables are set correctly.

-   **`config_manager.py`**
    -   **Purpose:** Manages loading all configuration files.
    -   **Details:** The `ConfigManager` class is responsible for reading settings from the `.json` files in the `config/` directory (e.g., for counting, mapping, and thresholds) and applying them at startup.

-   **`pipeline_manager.py`**
    -   **Purpose:** Builds and controls the GStreamer pipeline.
    -   **Details:** This is the most complex part. The `PipelineManager` class creates all the GStreamer elements (source, decoder, inference engine, tracker, encoder, sink), links them together, and manages the pipeline's lifecycle (play, stop).

-   **`service_manager.py`**
    -   **Purpose:** Manages background communication services.
    -   **Details:** The `ServiceManager` class runs background threads for:
        1.  **Publishing:** Sending analysis results (like object coordinates) to a backend via WebSocket.
        2.  **Subscribing:** Listening for settings updates from the backend via WebSocket.
