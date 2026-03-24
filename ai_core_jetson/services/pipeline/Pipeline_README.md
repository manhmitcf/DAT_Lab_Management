# PipelineManager: DeepStream Orchestrator

## 1. Responsibilities
- **Architecture Assembly**: Connects all GStreamer elements (`source`, `muxer`, `nvinfer`, `nvdsosd`, `sink`).
- **Lifecycle Management**: Handles `start()`, `stop()`, and error recovery.
- **Dynamic Linking**: Handles pad-added signals for demuxers (supporting MP4/RTSP).
- **Probe Injection**: Orchestrates where the `AnalyticsProbe` sits in the data flow.

## 2. Pipeline Structure
```mermaid
graph LR
    Src[Source: File/V4L2] --> Dec[Decoder]
    Dec --> Mux[nvstreammux]
    Mux --> Infer[nvinfer: YOLOX]
    Infer -->|Probe Attached| Conv[nvvideoconvert]
    Conv --> OSD[nvdsosd]
    OSD --> Sink[fakesink/eglsink]
```

## 3. Usage Example

```python
from services.pipeline_manager import PipelineManager
from services.analytics_probe import AnalyticsProbe

# 1. Create Manager
manager = PipelineManager()

# 2. Build for a specific source
manager.build_pipeline(
    source_uri="/path/to/video.mp4",
    config_infer="config/config_infer.txt"
)

# 3. Attach Analytics logic
probe = AnalyticsProbe(...)
manager.attach_probe(probe)

# 4. Run (blocks until EOS or Error)
manager.run()
```

## 4. Key Features
- **Hybrid Input**: Support for local video files, USB cameras (`v4l2src`), and network streams.
- **Hardware Acceleration**: Uses `nvvideoconvert` and `nvdsosd` for GPU-side processing.
- **Error Resilient**: Integrated with `BusManager` to handle crashes or end-of-video events gracefully.
