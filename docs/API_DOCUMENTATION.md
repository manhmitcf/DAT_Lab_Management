# EdgeSentinelAI — API Documentation

> **Version:** 2.2.0 · **Base URL:** `/api/v1` · **Auth:** Bearer JWT · **Format:** JSON  
> **Lưu ý:** Hệ thống sử dụng **1 camera duy nhất**. Không cần endpoint quản lý nhiều camera.

---

# Tab 1 — Live Monitor (`/`)

Trang chính, hiển thị realtime: video feed, bounding box, floor plan 2D, stats.

---

## WebSocket `/ws/frames` ⭐ Core

**Endpoint quan trọng nhất.** BE gửi từng frame đã xử lý qua WebSocket. FE dùng payload này để vẽ toàn bộ giao diện Live Monitor.

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

### FE dùng payload này cho:

| Thành phần UI | Dữ liệu | Cách xử lý |
|---------------|---------|-------------|
| **Video feed** | `frame_image` | Decode base64 → hiển thị |
| **BoundingBox** | `objects[].bbox` + `width_frame`, `height_frame` | `x% = bbox[0] / width_frame` |
| **Floor Plan** | `objects[].coordinates_2D` + `width_2D`, `height_2D` | `x% = coord[0] / width_2D * 100` |
| **Occupancy** | `objects.length` | Đếm số objects |
| **Ingress** | `count_in` | Hiển thị trực tiếp |
| **Egress** | `count_out` | Hiển thị trực tiếp |

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

## `GET /stats`

Fallback cho Stats Bar khi chưa có WebSocket.

```json
{
  "person_count": 104,
  "person_count_change": 5.2,
  "entry_today": 847,
  "exit_today": 743,
  "fps": 30
}
```

| Field | UI | Mô tả |
|-------|-----|--------|
| `person_count` | "Occupancy" | Số người hiện tại |
| `person_count_change` | Badge `+5.2%` | % thay đổi |
| `entry_today` | "Ingress" | Tổng lượt vào hôm nay |
| `exit_today` | "Egress" | Tổng lượt ra hôm nay |
| `fps` | "FPS" | Khung hình/giây hiện tại |

---

# Tab 2 — Analytics (`/analytics`)

Dashboard phân tích với KPI cards, biểu đồ, heatmap.

---

## `GET /analytics?period={period}`

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

## `GET /analytics/occupancy-trends?period={period}`

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

## `GET /analytics/activity-heatmap?period={period}`

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

## `GET /analytics/behavior-distribution?period={period}`

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

## `GET /alerts`

| Param | Type | Mô tả |
|-------|------|--------|
| `type` | string | `critical` · `high` · `low` |
| `event` | string | `falls` · `intrusions` · `fighting` |
| `search` | string | Tìm theo event/location |
| `resolved` | bool | Lọc trạng thái |
| `limit` | int | Default: 50 |
| `offset` | int | Phân trang |

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
      "location": "DAT Lab",
      "timestamp": "2026-02-09T10:42:35Z",
      "confidence": 0.96,
      "resolved": false,
      "clip_url": "/clips/alert-001.mp4"
    }
  ]
}
```

Footer: `total` Events Today · `resolution_rate`% Resolution · Page X of `total_pages`

---

## `PATCH /alerts/{id}`

```json
{ "resolved": true }
```

---

# Tab 4 — History (`/history`)

Xem lại video và stats trong quá khứ. Chỉ 1 camera — không cần filter camera.

---

## `GET /history/recordings`

| Param | Type | Mô tả |
|-------|------|--------|
| `date` | string | ISO date (`2026-02-28`) |
| `limit` | int | Default: 50 |
| `offset` | int | Phân trang |

```json
{
  "total": 24,
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

## `GET /history/recordings/{id}/stream`

Video playback. Response: video/mp4 hoặc HLS.

---

## `GET /history/recordings/{id}/stats`

Stats chi tiết tại thời điểm recording.

```json
{
  "events": 12,
  "peak_occupancy": 34,
  "alerts": 1,
  "duration": "30:00",
  "occupancy_timeline": [
    { "time": "08:00", "count": 12 },
    { "time": "08:05", "count": 18 }
  ]
}
```

---

## `GET /history/recordings/{id}/frames`

Lấy lại frames đã lưu (`save_to_db: true`). Format giống `/ws/frames`.

**Query:** `?from=08:00:00&to=08:30:00&interval=5s`

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
| **`/ws/frames`** | Frame data (ảnh, bbox, 2D, count) | ~30fps |

## Rate Limits

| Loại | Giới hạn |
|------|---------|
| REST | 100 req/min |
| WebSocket | 50 concurrent |
