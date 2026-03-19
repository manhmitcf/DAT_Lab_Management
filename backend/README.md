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
    "image_size": {
      "width": 1920,
      "height": 1080
    },
    "map_size": {
      "width": 1000,
      "height": 1000
    },
    "correspondences": [
      {
        "label": "p1",
        "camera": [523.2, 412.8],
        "map": [120.5, 300.0]
      }
    ]
  }
  ```

#### Messages Received by Client

- **Frontend (Sender)** will receive a success confirmation.
- **Edge Device (Listener)** will receive the exact `MappingRequest` payload sent by the Frontend.

---

### 2. Endpoint: `/ws/settings/counting/`

This endpoint is used for configuring the counting line. It follows a broadcast model where a "sender" (Frontend) sends data that is then distributed to all "listeners" (Edge Devices).

- **Role**: Counting Line Configuration
- **Actors**:
    - **Sender (Frontend)**: Sends counting line configuration.
    - **Listener (Edge Device)**: Receives counting line configuration.

#### Messages Sent by Client (Frontend)

- **Action**: Send a JSON object representing the counting line settings.
- **Payload Schema**: `CountingRequest`
- **Example Payload**:
  ```json
  {
    "line_start": [984.47, 346.44],
    "line_end": [903.68, 383.81],
    "inside_point": [1001.31, 375.39],
    "crossing_margin": 10,
    "frame_height": 1080,
    "frame_width": 1920
  }
  ```

#### Messages Received by Client

- **Frontend (Sender)** will receive a success confirmation.
- **Edge Device (Listener)** will receive the exact `CountingRequest` payload sent by the Frontend.

---

### 3. Endpoint: `/ws/persist/metadata/`

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

### 4. Error Handling (All Endpoints)

If a client sends an invalid payload to any of the WebSocket endpoints, the connection will **remain open**, and the server will return an error JSON object. 

**Invalid JSON Format (Syntax error):**
```json
{
  "error": {
    "code": "INVALID_JSON",
    "message": "Malformed JSON data format."
  }
}
```

**Schema Validation Error (Missing fields, wrong types):**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid data format.",
    "details": [
      {
        "type": "...",
        "loc": ["..."],
        "msg": "..."
      }
    ]
  }
}
```

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