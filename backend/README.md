# DAT Lab Management - Backend

This is the Backend service for the DAT Lab Management system, built with **Django**, **Django REST Framework**, and **Django Channels**. It provides WebSocket endpoints for camera calibration and metadata persistence.

## 🚀 Core Architecture

The backend is designed with a clear separation of concerns:

1.  **Camera Calibration**: A WebSocket endpoint (`/ws/settings/mapping/`) allows a frontend client to send calibration data, which is then broadcast to listening edge devices.
2.  **Metadata Persistence**: A dedicated WebSocket endpoint (`/ws/persist/metadata/`) receives analytics data from the Edge Device and pushes it to a Celery queue for asynchronous database saving. This decouples data ingestion from database writes, ensuring high throughput.
3.  **WebRTC Integration (Future)**: The system is designed to integrate with a WebRTC media server like Janus. The backend will act as a controller/API server, while video streams are handled by the media server.

---

##  WebSocket API Documentation

### 1. Endpoint: `/ws/settings/mapping/`

This endpoint is used for real-time calibration mapping. It follows a broadcast model where a "sender" (Frontend) sends data that is then distributed to all "listeners" (Edge Devices).

- **Role**: Calibration and Mapping
- **Actors**:
    - **Sender (Frontend)**: Sends mapping data.
    - **Listener (Edge Device)**: Receives mapping data.

#### Messages Sent by Client (Frontend)

- **Action**: Send a JSON object representing the mapping configuration.
- **Payload Schema**: `MappingRequest`
- **Example Payload**:
  ```json
  {
    "shapes": [
      {
        "type": "point",
        "camera": [[485.5, 312.0]],
        "floor_plan": [[200.1, 150.2]]
      },
      {
        "type": "line",
        "camera": [[200, 200], [900, 200]],
        "floor_plan": [[100, 100], [700, 100]]
      }
    ]
  }
  ```

#### Messages Received by Client

- **Frontend (Sender)** will receive a success confirmation:
  ```json
  {
      "status": "ok",
      "message": "Calibration data received and saved successfully."
  }
  ```
- **Edge Device (Listener)** will receive the exact `MappingRequest` payload sent by the Frontend.

---

### 2. Endpoint: `/ws/persist/metadata/`

This is a one-way endpoint designed for the Edge Device to send analytics data to the backend for storage. It does not broadcast any information.

- **Role**: Data Persistence
- **Actor**:
    - **Sender (Edge Device)**: Sends frame metadata.

#### Messages Sent by Client (Edge Device)

- **Action**: Send a JSON object representing the metadata of a single frame.
- **Payload Schema**: `FrameData` (without `frame_image`)
- **Example Payload**:
  ```json
  {
    "timestamp": "2026-03-11T10:00:00Z",
    "count_in": 5,
    "count_out": 2,
    "alert": "info",
    "save_to_db": true,
    "height_frame": 720,
    "width_frame": 1280,
    "objects": [
      {
        "track_id": 101,
        "bbox": [100.5, 200.0, 150.5, 280.0],
        "coordinates_2D": [110, 220]
      }
    ]
  }
  ```

#### Messages Received by Client

- **None**: By default, this endpoint does not send any success confirmation to reduce network traffic. It only sends a message back if an error occurs (e.g., validation error).

---

## 🛠️ Setup & Installation

### 1. Prerequisites
*   Python 3.8+
*   PostgreSQL
*   Docker (for Redis & Celery)

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Database Migration
```bash
python manage.py makemigrations
python manage.py migrate
```

### 4. Configuration (.env)
Create a `.env` file in the `backend/` directory:
```ini
# ... DB Config ...
USE_REDIS=True
REDIS_HOST=redis # Use Docker service name
```

## 🏃‍♂️ Running the Server (Docker Compose)

For a full development environment, use Docker Compose to run Django, Redis, and Celery.

1.  **Build and Run Services**:
    ```bash
    docker-compose up --build
    ```
2.  The Django development server will be available at `http://127.0.0.1:8000`.
```