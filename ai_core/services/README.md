# External Services

This directory contains modules responsible for communication with external services, such as a backend server or custom C++ libraries.

## File Descriptions

-   **`backend_gateway.py`**
    -   **Purpose:** Manages all WebSocket communication with the backend server.
    -   **Details:**
        -   The `ResultPublisher` class connects to a WebSocket endpoint and sends real-time analysis data (e.g., object tracking information).
        -   The `SettingsSubscriber` class connects to other WebSocket endpoints to listen for configuration updates from the backend (e.g., changes to the counting line or mapping points). It runs in a separate thread.

-   **`cpp_probe_service.py`**
    -   **Purpose:** Provides a Python interface to a high-performance C++ library.
    -   **Details:** This module uses Python's `ctypes` library to load a custom C++ shared object (`.so`) file. It exposes functions from the C++ library so they can be called from Python. This is used to offload performance-critical tasks, like counting and mapping calculations, from Python to C++ for better efficiency.
