# DAT Lab Management - Backend

This is the Backend service for the DAT Lab Management system, built with **Django**, **Django REST Framework**, and **Django Channels**. It serves as the central hub for processing video analytics data from Edge Devices and broadcasting realtime updates to the Frontend.

## 🚀 Features Implemented

### 1. WebSocket API (Realtime Communication)
*   **Technology:** Django Channels (ASGI).
*   **Endpoints:**
    *   `ws://<host>:8000/ws/edge/data/`: For Edge Devices to push detection data.
    *   `ws://<host>:8000/ws/frontend/feed/`: For Frontend clients to receive realtime updates.
*   **Logic:**
    *   Receives JSON payloads from Edge Devices.
    *   **Broadcasts** data immediately to connected Frontend clients (Low latency).
    *   **Persists** data to PostgreSQL if `save_to_db: true` flag is set.

### 2. Database Models (PostgreSQL)
*   **`FrameData`**: Stores frame metadata (timestamp, count_in, count_out).
*   **`ObjectDetection`**: Stores detailed object info (bbox, confidence, tracking ID).
    *   Uses `JSONField` for flexible storage of bounding boxes and coordinates.
    *   Optimized for high-frequency writes.

### 3. Channel Layer Configuration
*   **Flexible Switching:** Easily switch between Development and Production modes via `.env`.
    *   **Development:** Uses `InMemoryChannelLayer` (No setup required).
    *   **Production:** Uses `RedisChannelLayer` (Requires Redis).

### 4. Docker Integration
*   **Redis Service:** Includes `docker-compose.yml` to spin up a Redis container for the Channel Layer.

## 📂 Project Structure

```
backend/
├── config/                 # Project configuration (settings, asgi, wsgi)
├── Lab_Management/         # Main App
│   ├── consumers.py        # WebSocket logic (Edge & Frontend consumers)
│   ├── models.py           # Database models (FrameData, ObjectDetection)
│   ├── routing.py          # WebSocket URL routing
│   ├── views.py            # HTTP Views (if any)
│   └── ...
├── doc/                    # Documentation files
├── simulate_edge_device.py # Script to simulate Edge Device data
├── docker-compose.yml      # Docker configuration for Redis
├── manage.py               # Django management script
└── requirements.txt        # Python dependencies
```

## 🛠️ Setup & Installation

### 1. Prerequisites
*   Python 3.8+
*   PostgreSQL (Optional for Dev, required for Prod)
*   Docker (Optional, for Redis)

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
Create a `.env` file in the `backend/` directory (refer to `.env.example`):
```ini
# ... DB Config ...
USE_REDIS=False  # Set to True to use Redis
```

## 🏃‍♂️ Running the Server

### Development Mode (InMemory)
```bash
python manage.py runserver
```

### Production Mode (Redis)
1.  Start Redis:
    ```bash
    docker-compose up -d
    ```
2.  Update `.env`: `USE_REDIS=True`
3.  Run Server:
    ```bash
    python manage.py runserver
    ```

## Test Frontend Reception
Use **Postman** to connect to `ws://127.0.0.1:8000/ws/frontend/feed/` and observe the incoming realtime data.

