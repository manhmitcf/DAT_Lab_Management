# DAT Lab Management

<p align="center">
  <b>Real-time Edge AI laboratory monitoring with tracking, counting, 2D mapping, analytics, and dashboard visualization.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-Edge_AI-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/PyTorch-Detection_&_Tracking-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" alt="PyTorch" />
  <img src="https://img.shields.io/badge/Django-Backend-092E20?style=for-the-badge&logo=django&logoColor=white" alt="Django" />
  <img src="https://img.shields.io/badge/Next.js-Dashboard-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/NVIDIA-Jetson_Ready-76B900?style=for-the-badge&logo=nvidia&logoColor=white" alt="NVIDIA Jetson" />
</p>

DAT Lab Management is a real-time laboratory monitoring system that combines Edge AI, a Django backend, and a Next.js dashboard. The platform detects and tracks people from camera/video streams, counts entries and exits, maps tracked positions onto a 2D floor plan, and visualizes live occupancy and analytics data for lab management.

## ✨ Core Features

- 🎯 **Real-time person detection and tracking** using YOLOX and OCSort.
- 🚪 **Entry and exit counting** based on configurable counting lines.
- 📊 **Live occupancy monitoring** with current people count, FPS, and alert status.
- 🗺️ **2D floor-plan mapping** that projects tracked people from camera coordinates onto a calibrated map.
- 🔌 **Real-time metadata streaming** from the Edge AI pipeline to the backend and frontend through WebSocket.
- 📈 **Analytics dashboard** for occupancy trends, traffic statistics, heatmaps, flow ratios, peak occupancy, and CSV export.
- ⚙️ **Calibration settings** for updating mapping points and counting-line configuration from the web interface.
- 🎥 **Optional WebRTC video streaming** through Janus Gateway for live camera playback.
- 🚀 **Jetson-ready AI deployment** with Docker/TensorRT-oriented support for edge inference.
- ⚡ **Real-time Jetson Nano 8GB deployment** currently available on the `aicore/optimize_tracking/deploy_jetson` branch.

## 🧭 High-Level Architecture

```text
Camera / Video
     |
     v
AI Core
- YOLOX detection
- OCSort tracking
- Counting service
- 2D mapping service
     |
     | WebSocket metadata
     v
Backend
- Django REST API
- Django Channels WebSocket server
- Celery background persistence
- PostgreSQL / SQLite storage
     |
     v
Frontend
- Next.js dashboard
- Live monitoring
- Analytics
- Settings and calibration
```

## 📁 Project Structure

```text
.
├── ai_core/    # Edge AI pipeline, tracking, counting, mapping, and deployment utilities
├── backend/    # Django backend, WebSocket consumers, REST APIs, Celery tasks, and database models
└── frontend/   # Next.js dashboard, live view, analytics pages, settings, and UI components
```

## 🎬 Demo Videos

The repository includes lightweight GIF previews for quick viewing in the README, with links to the full compressed videos.

### Mapping Demo

Demonstrates 2D floor-plan mapping and projected tracking results.

![Mapping Demo Preview](docs/mapping-demo-preview.gif)

[▶ Watch full mapping demo](ai_core/videos/result_map_compressed.mp4)

### Full System Demo

Demonstrates the full workflow, including people detection, tracking, counting, occupancy monitoring, and dashboard visualization.

![Full System Demo Preview](docs/full-system-demo-preview.gif)

[▶ Watch full system demo](ai_core/videos/result_demo_compressed.mp4)

## 🛠️ Technology Stack

### 🧠 AI Core

<p>
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white" alt="PyTorch" />
  <img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=flat-square&logo=opencv&logoColor=white" alt="OpenCV" />
  <img src="https://img.shields.io/badge/NumPy-013243?style=flat-square&logo=numpy&logoColor=white" alt="NumPy" />
  <img src="https://img.shields.io/badge/NVIDIA_TensorRT-76B900?style=flat-square&logo=nvidia&logoColor=white" alt="TensorRT" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
</p>

- YOLOX for object detection.
- OCSort for multi-object tracking.
- OpenCV and NumPy for video/frame processing.
- Pydantic and websocket-client for structured metadata streaming.
- ONNX, ONNX Runtime, and TensorRT for optimized edge deployment.
- Docker support for NVIDIA/Jetson environments.

### 🖥️ Backend

<p>
  <img src="https://img.shields.io/badge/Django-092E20?style=flat-square&logo=django&logoColor=white" alt="Django" />
  <img src="https://img.shields.io/badge/Django_REST-ff1709?style=flat-square&logo=django&logoColor=white" alt="Django REST Framework" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Celery-37814A?style=flat-square&logo=celery&logoColor=white" alt="Celery" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

- Django 4.2 and Django REST Framework for APIs.
- Django Channels and Daphne for WebSocket/ASGI communication.
- Celery and Redis for background persistence workflows.
- PostgreSQL/Supabase for production storage.
- SQLite fallback for local development.
- WhiteNoise for static file serving.

### 🌐 Frontend

<p>
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Zustand-181717?style=flat-square&logo=react&logoColor=white" alt="Zustand" />
</p>

- Next.js 16 and React 19 for the dashboard application.
- TypeScript for typed frontend development.
- Tailwind CSS 4 for styling.
- Zustand for real-time dashboard state management.
- Recharts for analytics visualization.
- jsPDF and html-to-image for reporting/export workflows.
- WebSocket client for live metadata updates.
- Optional Janus WebRTC integration for live camera playback.

## 🔄 Main Data Flow

1. The AI Core reads camera/video frames and runs detection, tracking, counting, and 2D mapping.
2. The AI Core sends frame metadata to the backend through WebSocket.
3. The backend validates, broadcasts, and optionally persists the metadata.
4. The frontend receives real-time updates and renders the live dashboard, floor-plan markers, alerts, and analytics.

## 🧩 Main Modules

### `ai_core`

Responsible for edge-side computer vision processing:

- Person detection
- Multi-object tracking
- Counting line logic
- Coordinate mapping to a 2D floor plan
- WebSocket publishing to the backend
- ONNX/TensorRT deployment utilities

### `backend`

Acts as the central communication and persistence layer:

- Receives real-time metadata from edge devices
- Broadcasts metadata to connected dashboard clients
- Stores frame and object-detection data
- Provides REST APIs for settings and analytics
- Supports Redis and Celery for production workflows

### `frontend`

Provides the user-facing monitoring interface:

- Live camera/dashboard view
- Occupancy metrics
- Alert level display
- Floor-plan visualization
- Analytics charts
- Mapping and counting calibration UI

## ⚙️ Runtime Configuration Overview

Common environment variables include:

```env
# Frontend
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_JANUS_URL=
NEXT_PUBLIC_JANUS_MOUNTPOINT=1

# AI Core
RESULTS_WS_URL=ws://localhost:8000/ws/persist/metadata/
MAPPING_SETTINGS_WS_URL=ws://localhost:8000/ws/settings/mapping/
COUNTING_SETTINGS_WS_URL=ws://localhost:8000/ws/settings/counting/
API_BEARER_TOKEN=
```

## 🔌 WebSocket Endpoints

| Endpoint | Purpose |
| --- | --- |
| `/ws/persist/metadata/` | Receives AI metadata and broadcasts it to frontend clients |
| `/ws/settings/mapping/` | Sends mapping calibration updates |
| `/ws/settings/counting/` | Sends counting-line configuration updates |

## 📡 REST API Areas

- Account and user APIs
- Lab management settings APIs
- Analytics summary APIs
- Occupancy trend APIs
- Heatmap APIs
- Traffic and flow-ratio APIs
- CSV export APIs

## 🙏 Acknowledgements

The core tracking component is based on [OC_SORT](https://github.com/noahcao/OC_SORT). We sincerely acknowledge the original authors for their work and contribution to the multi-object tracking community.

## 📝 Notes

- The system is designed for an edge-to-cloud/dashboard workflow.
- The AI pipeline can run locally or on NVIDIA Jetson-class devices.
- The optimized Jetson deployment has been tested in real time on Jetson Nano 8GB on branch `aicore/optimize_tracking/deploy_jetson`.
- The backend can use SQLite for development or PostgreSQL/Supabase for production.
- WebSocket metadata and WebRTC video are separate streams: metadata drives dashboard state, while Janus WebRTC can provide live camera playback.
