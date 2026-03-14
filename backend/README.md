# DAT Lab Management - Backend

This is the Backend service for the DAT Lab Management system, built with **Django**, **Django REST Framework**, and **Django Channels**. It provides WebSocket endpoints for camera calibration and real-time metadata distribution.

## 🚀 Core Architecture

The backend is designed with a clear separation of concerns:

1.  **Camera Calibration**: A WebSocket endpoint (`/ws/settings/mapping/`) allows a frontend client to send calibration data, which is then broadcast to listening edge devices.
2.  **Real-time Metadata & Persistence**: A dual-purpose WebSocket endpoint (`/ws/persist/metadata/`) receives analytics data from the Edge Device. It immediately **broadcasts** this data to all connected Frontend clients for real-time UI updates and simultaneously pushes it to a Celery queue for asynchronous database saving.
3.  **WebRTC Integration**: The system is designed to integrate with a WebRTC media server like Janus. The video stream is handled by Janus, while this Django backend provides the necessary metadata and control channels.

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
      }
    ]
  }
  ```

#### Messages Received by Client

- **Frontend (Sender)** will receive a success confirmation.
- **Edge Device (Listener)** will receive the exact `MappingRequest` payload sent by the Frontend.

---

### 2. Endpoint: `/ws/persist/metadata/`

This is a dual-purpose endpoint for both real-time UI updates and data persistence.

- **Role**: Real-time Metadata Distribution & Persistence
- **Actors**:
    - **Sender (Edge Device)**: Connects to send frame metadata.
    - **Listener (Frontend)**: Connects to receive real-time metadata for UI updates (e.g., counters, alerts).

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

#### Messages Received by Client (Frontend)

- The Frontend will receive the exact `FrameData` payload that the Edge Device sends, allowing the UI to update in real-time.

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