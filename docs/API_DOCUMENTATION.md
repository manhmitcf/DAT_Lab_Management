# EdgeSentinelAI — API Documentation

> **Version:** 2.3.0 · **Base URL:** `/api/lab_management` · **Auth:** Bearer JWT · **Format:** JSON  
> **Lưu ý:** Hệ thống sử dụng **1 camera duy nhất**. Không cần endpoint quản lý nhiều camera.

---

# Tab 1 — Live Monitor (`/`)

Trang chính, hiển thị realtime: video feed, bounding box, floor plan 2D, stats.

---

## WebSocket `/api/lab_management/ws/frames` ⭐ Core

**Endpoint quan trọng nhất.** BE gửi từng frame đã xử lý qua WebSocket. FE dùng payload này để vẽ toàn bộ giao diện Live Monitor.

```json
{
  "frame_id": 1001,
  "timestamp": "2023-10-27T10:00:00.123Z",
  "count_in": 15,
  "count_out": 8,
  "fps": 30,
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

### FE dùng payload này cho:

| Thành phần UI | Dữ liệu | Cách xử lý |
|---------------|---------|-------------|
| **Video feed** | `frame_image` | Decode base64 → hiển thị |
| **BoundingBox** | `objects[].bbox` + `width_frame`, `height_frame` | `x% = bbox[0] / width_frame` |
| **Floor Plan** | `objects[].coordinates_2D` + `width_2D`, `height_2D` | `x% = coord[0] / width_2D * 100` |
| **Occupancy** | `objects.length` | Đếm số objects |
| **Ingress** | `count_in` | Hiển thị trực tiếp |
| **Egress** | `count_out` | Hiển thị trực tiếp |
| **FPS** | `fps` | Hiển thị trực tiếp |

### Objects Array

| Field | Type | Mô tả |
|-------|------|--------|
| `track_id` | int | ID tracking (label: `HUMAN #101`) |
| `class` | string | Loại vật thể (`person`) |
| `conf` | float | Độ tin cậy (0–1) |
| `bbox` | int[4] | `[x1, y1, x2, y2]` — pixel tuyệt đối trên ảnh gốc |
| `coordinates_2D` | int[2] | `[x, y]` — pixel trên bản đồ 2D |

> [!IMPORTANT]
> `bbox` và `coordinates_2D` đều là tọa độ **pixel**. FE chia cho kích thước tương ứng để chuyển sang %.

> [!NOTE]
> `save_to_db: true` = BE đã lưu vào DB (cho History). `false` = chỉ forward realtime.

---

# Tab 2 — Analytics (`/analytics`)

Dashboard phân tích với KPI cards, biểu đồ, heatmap.

---

## `GET /api/lab_management/analytics?period={period}`

`period`: `1h` · `today` · `7d` · `30d`

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

| Field → UI |
|------------|
| `total_events` → KPI "Total Detections" (featured card) |
| `avg_confidence` → KPI "Detection Accuracy" |
| `peak_time` + `peak_occupancy` → KPI "Peak" |
| `system_uptime` → KPI "Uptime" |
| `alert_distribution` → Donut chart |

---

## `GET /api/lab_management/analytics/occupancy-trends?period={period}`

Line chart 3 đường (occupancy, ingress, egress).

```json
{
  "data": [
    { "time": "00:00", "occupancy": 35, "ingress": 12, "egress": 8 },
    { "time": "01:00", "occupancy": 28, "ingress": 5, "egress": 12 }
  ]
}
```

---

## `GET /api/lab_management/analytics/activity-heatmap?period={period}`

Heatmap 24 ô (hourly activity). `intensity`: 0.0 → 1.0.

```json
{
  "data": [
    { "hour": 0, "intensity": 0.15 },
    { "hour": 1, "intensity": 0.08 }
  ]
}
```

---

## `GET /api/lab_management/analytics/behavior-distribution?period={period}`

Progress bars phân loại hành vi.

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

# Tab 3 — Alerts (`/alerts`)

Quản lý sự kiện bất thường. Timeline view.

---

## `GET /api/lab_management/alerts`

Lấy danh sách cảnh báo. Hệ thống lab chủ yếu phát hiện **đông đúc** (crowded) — khi số người vượt ngưỡng.

> [!NOTE]
> Endpoint này **không trả video**. Chỉ trả metadata + ảnh thumbnail. Video được trích xuất on-demand qua endpoint riêng.

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|--------|
| `type` | string | `critical` · `warning` · `info` (default: all) |
| `from` | string | ISO datetime bắt đầu (vd: `2026-02-28T00:00:00Z`) |
| `to` | string | ISO datetime kết thúc |

**Response:**

```json
{
  "total": 12,
  "alerts": [
    {
      "id": "alert-001",
      "type": "critical",
      "event": "Crowded",
      "start_time": "2026-02-28T14:32:15Z",
      "end_time": "2026-02-28T14:35:15Z"
    },
    {
      "id": "alert-002",
      "type": "warning",
      "event": "Crowded",
      "start_time": "2026-02-28T10:15:42Z",
      "end_time": "2026-02-28T10:16:42Z"
    }
  ]
}
```

### Field Reference

| Field | Type | Mô tả |
|-------|------|--------|
| `id` | string | ID duy nhất của alert |
| `type` | string | `critical` · `warning` · `info` |
| `event` | string | Loại sự kiện (mặc định: `Crowded`) |
| `start_time` | string | Thời điểm bắt đầu tình trạng alert |
| `end_time` | string | Thời điểm kết thúc tình trạng alert |

> [!IMPORTANT]
> FE hiển thị thời lượng bằng cách tính `end_time - start_time`.

---

## `GET /api/lab_management/alerts/{id}/video`

BE nhận `id` → tra DB lấy `start_time` và `end_time` → trích xuất đoạn video tương ứng từ recording → trả về stream.

**Flow:**
```
FE gọi: GET /api/lab_management/alerts/alert-001/video
        ↓
BE tra DB: alert-001 → start=14:32:15, end=14:35:15
        ↓
BE trích xuất video từ recording (ffmpeg hoặc tương tự)
        ↓
Response: video/mp4 stream
```

> [!NOTE]
> Video **không lưu sẵn**, chỉ trích xuất khi user yêu cầu → tiết kiệm storage.

---

## `PUT /api/lab_management/alerts/threshold`

Cấu hình ngưỡng cảnh báo. Tách 2 mức để BE phân loại chính xác.

```json
// Request
{
  "warning_threshold": 30,
  "critical_threshold": 45
}

// Response
{
  "warning_threshold": 30,
  "critical_threshold": 45,
  "updated_at": "2026-02-28T15:00:00Z"
}
```

| Mức | Điều kiện | Ví dụ |
|-----|-----------|-------|
| `info` | Đông bất thường nhưng chưa vượt ngưỡng | 25 người (< 30) |
| `warning` | `person_count >= warning_threshold` | 35 người (≥ 30) |
| `critical` | `person_count >= critical_threshold` | 50 người (≥ 45) |

---

# Tab 4 — History (`/history`)

Xem lại video và stats trong quá khứ. Chỉ 1 camera — không cần filter camera.

---

## `GET /api/lab_management/history/recordings`

Lấy danh sách recordings trong ngày. Cho phép chọn khoảng giờ bất kỳ. Video trả về giới hạn tối đa **1 tiếng**.

| Param | Type | Mô tả |
|-------|------|--------|
| `date` | string | ISO date (`2026-02-28`) |
| `from` | string | Giờ bắt đầu (`08:00`) |
| `to` | string | Giờ kết thúc (`09:00`, tối đa cách `from` 1h) |

> [!IMPORTANT]
> Khoảng cách `from` → `to` tối đa **60 phút**. BE trả lỗi nếu vượt quá.

```json
{
  "recordings": [
    {
      "id": "rec-001",
      "date": "2026-02-28",
      "time_start": "08:00:00",
      "time_end": "08:30:00",
      "location": "DAT Lab",
      "thumbnail_url": "https://...",
      "duration": "30:00",
      "events": 12,
      "peak_occupancy": 34,
      "alerts": 1
    }
  ]
}
```

---

## `GET /api/lab_management/history/recordings/{id}/stream`

Video playback. Response: `video/mp4` hoặc HLS.

---

# Chung

## Errors

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Invalid token" } }
```

| HTTP | Code |
|------|------|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 404 | `NOT_FOUND` |
| 500 | `INTERNAL_ERROR` |

## WebSocket

| Endpoint | Dữ liệu | Tần suất |
|----------|---------|----------|
| **`/api/lab_management/ws/frames`** | Frame data (ảnh, bbox, 2D, count) | ~30fps |

## Rate Limits

| Loại | Giới hạn |
|------|---------|
| REST | 100 req/min |
| WebSocket | 50 concurrent |
