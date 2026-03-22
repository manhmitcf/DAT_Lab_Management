# Configuration Files

This directory holds the configuration files that control the behavior of the DeepStream application.

## File Descriptions

-   **`data_config.py`**
    -   Contains Python classes (`MappingConfig`, `CountingConfig`) that provide a structured way to load and access the settings from the `.json` files.

-   **`counting_config.json`**
    -   Stores the settings for the line-crossing feature. This includes the coordinates of the line and the point that defines the "inside" direction.

-   **`mapping_config.json`**
    -   Stores the settings for the homography mapping. This includes the correspondence points between the camera view and the 2D map.

-   **`threshold_config.json`**
    -   Stores the thresholds for crowd density or occupancy, which determine when to trigger "info", "warning", or "critical" alerts.
