# EdgeSentinelAI — API Documentation

> **Version:** 2.0.0  
> **Base URL:** `https://api.edgesentinel.ai/v1`  
> **Auth:** Bearer Token (JWT)  
> **Format:** JSON · Timestamps in ISO 8601

---

# Part 1 — Core Endpoints (Bắt buộc)

> Các endpoint này cung cấp dữ liệu cho toàn bộ key features của frontend. Thiếu bất kỳ endpoint nào trong phần này, giao diện sẽ không hoạt động được.

---

## 1.1 System Stats

### `GET /stats`

Cung cấp dữ liệu cho **Stats Bar** (command strip) trên trang Live Monitor.

**Response:**
```json
{
  "person_count": 104,
  "person_count_change": 5.2,
  "entry_today": 847,
  "exit_today": 743,
  "active_cameras": 12,
  "total_cameras": 14,
  "inference_time": 12,
  "metadata_rate": 32.5
}
```

| Field | Type | Hiển thị tại | Mô tả |
|-------|------|-------------|--------|
| `person_count` | int | Metric "Occupancy" | Số người hiện tại trong khu vực |
| `person_count_change` | float | Badge `+5.2%` | % thay đổi so với khung giờ trước |
| `entry_today` | int | Metric "Ingress" (xanh) | Tổng lượt vào từ 00:00 |
| `exit_today` | int | Metric "Egress" (cam) | Tổng lượt ra từ 00:00 |
| `active_cameras` | int | Metric "Sensors" | Camera đang online |
| `total_cameras` | int | Metric "Sensors" (mẫu số) | Tổng camera đã đăng ký |
| `inference_time` | int | Metric "Latency" | Thời gian suy luận trung bình (ms) |
| `metadata_rate` | float | Video overlay | Tốc độ metadata (msg/s) |

### `WebSocket /ws/stats`

Realtime cập nhật stats mỗi 1 giây. Payload giống `GET /stats`.

---

## 1.2 Cameras

### `GET /cameras`

Danh sách camera cho **Camera Grid** trên trang Live Monitor.

**Response:**
```json
{
  "cameras": [
    {
      "id": "cam-01",
      "name": "CAM-01",
      "location": "Main Lobby",
      "image_url": "https://...",
      "status": "online",
      "resolution": "4K",
      "fps": 30
    }
  ]
}
```

| Field | Type | Mô tả |
|-------|------|--------|
| `id` | string | Unique ID |
| `name` | string | Tên hiển thị (định dạng `CAM-XX`) |
| `location` | string | Vị trí vật lý |
| `image_url` | string | URL thumbnail/snapshot |
| `status` | enum | `online` · `offline` · `heavy` · `error` |
| `resolution` | string | Độ phân giải (`4K`, `1080p`, ...) |

### `GET /cameras/{id}/stream`

WebSocket / WebRTC endpoint cho live video stream.

---

## 1.3 Alerts

### `GET /alerts`

Nguồn dữ liệu cho **Alert Management** (trang Alerts) và **Recent Alerts** panel (trang Live Monitor).

**Query Parameters:**
| Param | Type | Default | Mô tả |
|-------|------|---------|--------|
| `type` | string | — | `critical` · `high` · `low` |
| `event` | string | — | `falls` · `intrusions` · `fighting` (cho SegmentedControl filter) |
| `resolved` | bool | — | Lọc theo trạng thái xử lý |
| `search` | string | — | Full-text search theo event + location |
| `limit` | int | 50 | Số kết quả tối đa |
| `offset` | int | 0 | Phân trang |

**Response:**
```json
{
  "total": 128,
  "resolution_rate": 98,
  "total_pages": 12,
  "alerts": [
    {
      "id": "alert-001",
      "type": "critical",
      "event": "Fighting Detected",
      "icon": "sports_mma",
      "camera_id": "cam-04",
      "camera_name": "Camera 04",
      "location": "North Hallway",
      "timestamp": "2026-02-09T10:42:35Z",
      "confidence": 0.96,
      "resolved": false,
      "clip_url": "/clips/alert-001.mp4"
    }
  ]
}
```

> **Quan trọng:** Các trường `total`, `resolution_rate`, `total_pages` dùng cho footer bar: _"128 Events Today · 98% Resolution Rate · Page 1 of 12"_

| Severity `type` | Card style | Mô tả |
|-----------------|------------|--------|
| `critical` | Nền đỏ muted, viền đỏ | Nguy hiểm cao — cần xử lý ngay |
| `high` | Nền cam muted | Cần chú ý |
| `low` | Nền surface mặc định | Thông tin |

### `PATCH /alerts/{id}`

Resolve/unresolve một alert.

**Request:**
```json
{
  "resolved": true
}
```

**Response:** `200 OK` — trả về alert object đã cập nhật.

---

## 1.4 Analytics

### `GET /analytics`

Dữ liệu cho **4 KPI cards** trên trang Analytics.

**Query:** `?period=1h|today|7d|30d`

**Response:**
```json
{
  "total_events": 12482,
  "events_change": 12.4,
  "avg_confidence": 98.2,
  "confidence_change": -0.5,
  "peak_time": "14:30",
  "peak_occupancy": 84,
  "peak_zone": "Main Atrium",
  "system_uptime": 99.9,
  "alert_distribution": {
    "loitering": { "count": 482, "percentage": 40 },
    "fall": { "count": 124, "percentage": 10 },
    "area_breach": { "count": 434, "percentage": 35 },
    "other": { "count": 200, "percentage": 15 }
  }
}
```

| Field | Hiển thị tại | Mô tả |
|-------|-------------|--------|
| `total_events` | KPI card "Total Detections" (featured, col-span-5) | Tổng sự kiện phát hiện |
| `events_change` | Badge `+12.4%` | % thay đổi vs kỳ trước |
| `avg_confidence` | KPI card "Detection Accuracy" (col-span-3) | Độ chính xác trung bình |
| `peak_time` | KPI card "Peak" (col-span-2) | Giờ cao điểm |
| `peak_occupancy` | Dưới peak_time | Số người tại peak |
| `system_uptime` | KPI card "Uptime" (col-span-2) | % uptime hệ thống |
| `alert_distribution` | Donut chart "Incident Distribution" | Phân bố loại sự cố |

### `GET /analytics/occupancy-trends`

Dữ liệu cho biểu đồ **Occupancy Trends** (line chart 3 đường: occupancy, ingress, egress).

**Query:** `?period=today`

**Response:**
```json
{
  "data": [
    { "time": "00:00", "occupancy": 35, "ingress": 12, "egress": 8 },
    { "time": "01:00", "occupancy": 28, "ingress": 5, "egress": 12 }
  ]
}
```

---

## 1.5 Floor Plan

### `GET /floorplan/markers`

Vị trí realtime các entity trên **Floor Plan** panel (Live Monitor — right panel).

**Response:**
```json
{
  "markers": [
    {
      "id": 1,
      "x": 45.5,
      "y": 62.3,
      "type": "active",
      "label": "Person #42"
    },
    {
      "id": 2,
      "x": 78.2,
      "y": 45.1,
      "type": "alert",
      "label": "Incident"
    }
  ]
}
```

| `type` | UI | Mô tả |
|--------|-----|--------|
| `active` | Chấm xanh dương + glow | Entity đang di chuyển |
| `inactive` | Chấm xám mờ | Entity không di chuyển |
| `alert` | Chấm đỏ + pulse animation | Entity liên quan đến alert |

### `WebSocket /ws/floorplan`

Cập nhật realtime vị trí marker. Events: `marker_update`, `marker_remove`.

---

## 1.6 Realtime Frame Data

### `WebSocket /ws/frames`

**Đây là endpoint chính** — BE gửi toàn bộ dữ liệu xử lý của mỗi frame qua WebSocket. FE sử dụng payload này để cập nhật:
- **Camera Grid** — hiển thị frame ảnh (`frame_image`)
- **Stats Bar** — occupancy count, ingress/egress (`count_in`, `count_out`)
- **BoundingBox overlay** — vẽ bbox lên video (`objects[].bbox`)
- **Floor Plan** — vị trí trên bản đồ 2D (`objects[].coordinates_2D`)

**Payload (BE → FE):**
```json
{
  "frame_id": 1001,
  "timestamp": "2023-10-27T10:00:00.123Z",
  "count_in": 15,
  "count_out": 8,
  "alert": false,
  "save_to_db": true,

  "height_frame": 720,
  "width_frame": 1280,
  "height_2D": 500,
  "width_2D": 500,

  "frame_image": "/9j/4AAQSkZJRg...",

  "objects": [
    {
      "track_id": 101,
      "class": "person",
      "conf": 0.95,
      "bbox": [100, 200, 150, 300],
      "coordinates_2D": [125, 250]
    }
  ]
}
```

### Field Reference

| Field | Type | FE sử dụng | Mô tả |
|-------|------|-----------|--------|
| `frame_id` | int | Internal tracking | ID frame duy nhất |
| `timestamp` | string (ISO 8601) | Video overlay, Detection Log | Thời điểm xử lý frame |
| `count_in` | int | Stats Bar → "Ingress" | Tổng lượt vào tính đến frame này |
| `count_out` | int | Stats Bar → "Egress" | Tổng lượt ra tính đến frame này |
| `alert` | bool | Alert panel, badge pulse | `true` = frame chứa sự kiện bất thường |
| `save_to_db` | bool | — (metadata) | `true` = BE đã lưu vào DB, `false` = chỉ forward realtime |
| `height_frame` | int | BoundingBox tính toán | Chiều cao ảnh gốc (pixels) |
| `width_frame` | int | BoundingBox tính toán | Chiều rộng ảnh gốc (pixels) |
| `height_2D` | int | Floor Plan tính toán | Chiều cao bản đồ 2D (pixels) |
| `width_2D` | int | Floor Plan tính toán | Chiều rộng bản đồ 2D (pixels) |
| `frame_image` | string (base64) | Camera Grid — hiển thị frame | JPEG base64, optional |

### Objects Array

| Field | Type | FE sử dụng | Mô tả |
|-------|------|-----------|--------|
| `track_id` | int | BoundingBox label `HUMAN #101` | ID tracking duy nhất cho mỗi người |
| `class` | string | Filter / Badge | Loại vật thể (`person`, ...) |
| `conf` | float (0–1) | BoundingBox label, confidence bar | Độ tin cậy phát hiện |
| `bbox` | int[4] | BoundingBox overlay | `[x1, y1, x2, y2]` — tọa độ pixel trên ảnh gốc |
| `coordinates_2D` | int[2] | Floor Plan markers | `[x, y]` — tọa độ pixel trên bản đồ 2D |

> [!IMPORTANT]
> **BBox format:** `[x1, y1, x2, y2]` là tọa độ **pixel tuyệt đối** trên ảnh gốc (không phải normalized).  
> FE cần chia cho `width_frame` / `height_frame` để chuyển sang tỉ lệ phần trăm khi render overlay.

> [!IMPORTANT]
> **Coordinates_2D format:** `[x, y]` là tọa độ **pixel** trên bản đồ 2D.  
> FE cần chia cho `width_2D` / `height_2D` để chuyển sang phần trăm khi render lên Floor Plan.

### FE Processing Logic

```
// BoundingBox: pixel → normalized
bbox_normalized = {
  x:      bbox[0] / width_frame,
  y:      bbox[1] / height_frame,
  width:  (bbox[2] - bbox[0]) / width_frame,
  height: (bbox[3] - bbox[1]) / height_frame
}

// Floor Plan: pixel → percentage
marker = {
  x: (coordinates_2D[0] / width_2D) * 100,
  y: (coordinates_2D[1] / height_2D) * 100
}

// Stats: cập nhật trực tiếp
stats.entry_today = count_in
stats.exit_today = count_out
stats.person_count = objects.length
```

---

# Part 2 — Advanced Endpoints (Nâng cao)

> Các endpoint mở rộng. FE hiện tại có thể hoạt động mà không có các endpoint này (sử dụng mock data hoặc tính toán phía client). Triển khai khi cần tối ưu hoặc mở rộng tính năng.

---

## 2.1 Activity Heatmap

### `GET /analytics/activity-heatmap`

Dữ liệu cho **Hourly Activity** heatmap grid (trang Analytics — bottom row). FE hiện hardcode mảng intensity; endpoint này thay thế bằng dữ liệu thực.

**Query:** `?period=today`

**Response:**
```json
{
  "data": [
    { "hour": 0, "intensity": 0.15 },
    { "hour": 1, "intensity": 0.08 },
    { "hour": 23, "intensity": 0.12 }
  ]
}
```

---

## 2.2 Behavior Classification

### `GET /analytics/behavior-distribution`

Dữ liệu cho **Behavior Classification** progress bars (trang Analytics). Có thể tính từ `GET /stats` field `behavior_distribution` nhưng endpoint riêng cho phép query theo time period.

**Query:** `?period=today`

**Response:**
```json
{
  "data": [
    { "behavior": "walking", "percentage": 68 },
    { "behavior": "standing", "percentage": 24 },
    { "behavior": "sitting", "percentage": 5 },
    { "behavior": "loitering", "percentage": 3 }
  ]
}
```

---

## 2.3 Detection Activity Chart

### `GET /detections/activity`

Dữ liệu cho **Detection Activity** sparkline chart (Live Monitor — right panel). FE hiện render SVG path tĩnh.

**Query:** `?interval=2h&period=24h`

**Response:**
```json
{
  "data": [
    { "time": "00:00", "count": 45 },
    { "time": "02:00", "count": 22 }
  ]
}
```

---

## 2.4 Edge Devices

### `GET /devices`

Monitoring edge computing nodes. FE hiện không hiển thị trực tiếp nhưng có thể mở rộng trong trang Settings hoặc System Health.

**Response:**
```json
{
  "devices": [
    {
      "id": "jetson-01",
      "name": "Jetson Nano 01",
      "type": "jetson",
      "status": "online",
      "cpu_load": 45,
      "ram_used": 2.1,
      "ram_total": 4,
      "fps": 32,
      "temperature": 42
    }
  ]
}
```

| `type` | Mô tả |
|--------|--------|
| `jetson` | NVIDIA Jetson |
| `raspberry` | Raspberry Pi |
| `server` | Edge Server |

---

## 2.5 Alert Clips

### `GET /alerts/{id}/clip`

Download video clip cho alert event. Nút "Clip" trong Alerts page (hiện trên hover). Streaming MP4.

### `GET /alerts/export`

Export danh sách alerts ra CSV/PDF. Nút "Export" trên Analytics page.

**Query:** `?format=csv|pdf&period=today`

---

## 2.6 User & Auth

### `POST /auth/login`

```json
{
  "email": "admin@edge.ai",
  "password": "..."
}
```

**Response:**
```json
{
  "token": "eyJhbG...",
  "user": {
    "id": "usr-01",
    "name": "Admin User",
    "role": "admin",
    "avatar_url": "https://..."
  }
}
```

### `GET /auth/me`

Lấy thông tin user hiện tại cho sidebar profile (avatar + name + role).

### `POST /auth/logout`

Invalidate token. Nút "Logout" trong sidebar.

---

# Error Responses

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

| HTTP | Code | Mô tả |
|------|------|--------|
| 400 | `BAD_REQUEST` | Tham số không hợp lệ |
| 401 | `UNAUTHORIZED` | Token thiếu hoặc hết hạn |
| 403 | `FORBIDDEN` | Không có quyền truy cập |
| 404 | `NOT_FOUND` | Resource không tồn tại |
| 429 | `RATE_LIMITED` | Quá giới hạn request |
| 500 | `INTERNAL_ERROR` | Lỗi server |

---

# WebSocket Summary

| Endpoint | Dữ liệu | Tần suất | Trang sử dụng |
|----------|---------|----------|----------------|
| **`/ws/frames`** | Frame data (bbox, 2D coords, count, image) | Mỗi frame (~30fps) | Live Monitor (camera, bbox, floor plan, stats) |
| `/ws/stats` | `stats_update` | 1s | Live Monitor (stats bar — bổ sung/fallback) |
| `/ws/floorplan` | `marker_update` · `marker_remove` | Realtime | Live Monitor (floor plan — bổ sung/fallback) |

---

# Rate Limits

| Loại | Giới hạn |
|------|---------|
| REST API | 100 req/min per token |
| WebSocket | Connection limit: 50 concurrent |
