# EdgeSentinelAI — API Documentation

> **Version:** 2.3.0 · **Base URL:** `/api/lab_management` · **Auth:** Bearer JWT · **Format:** JSON  
> **Lưu ý:** Hệ thống sử dụng **1 camera duy nhất**. Không cần endpoint quản lý nhiều camera.

---

# Tab 1 — Live Monitor (`/`)

Trang chính, hiển thị realtime: video feed, bounding box, floor plan 2D, stats.

---

## WebSocket `/ws/frontend/frames/` ⭐ Core

**Endpoint quan trọng nhất.** BE gửi từng frame đã xử lý qua WebSocket. FE dùng payload này để vẽ toàn bộ giao diện Live Monitor.

> **URL thực tế:** `wss://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net/ws/frontend/frames/`

```json
{
  "timestamp": "2023-10-27T10:00:00.123Z", // Thời gian thực (UTC)
  "count_in": 15,                          // Tổng số người vào
  "count_out": 8,                          // Tổng số người ra
  "alert": "none",                         // Cấp độ cảnh báo: "none" | "info" | "warning" | "critical"
  "save_to_db": true,                      // True: Đã lưu vào DB (History)

  // Kích thước để Frontend vẽ tỉ lệ
  "height_frame": 720,
  "width_frame": 1280,
  "height_2D": 500,
  "width_2D": 500,

  // Hình ảnh - 2 định dạng (FE tự detect):
  //   Binary: message là ArrayBuffer (raw JPEG) — ưu tiên
  //   Base64: message là JSON string, field "frame_image" chứa chuỗi base64 — fallback
  "frame_image": "/9j/4AAQSkZJRg...",

  // Danh sách vật thể phát hiện được
  "objects": [
    {
      "track_id": 101,             // ID theo dõi (duy nhất cho mỗi người)
      "bbox": [100, 200, 150, 300], // Tọa độ khung bao [x1, y1, x2, y2] (pixel)
      "coordinates_2D": [125, 250]  // Tọa độ trên bản đồ 2D [x, y] (pixel)
    }
  ]
}
```

### FE dùng payload này cho:

| Thành phần UI | Dữ liệu | Cách xử lý |
|---------------|---------|-------------|
| **Video feed** | `frame_image` / binary frame | Binary: `URL.createObjectURL(Blob)` · Base64: `data:image/jpeg;base64,...` |
| **BoundingBox** | `objects[].bbox` + `width_frame`, `height_frame` | `x% = bbox[0] / width_frame` |
| **Floor Plan** | `objects[].coordinates_2D` + `width_2D`, `height_2D` | `x% = coord[0] / width_2D * 100` |
| **Occupancy** | `objects.length` | Đếm số objects |
| **Ingress** | `count_in` | Hiển thị trực tiếp |
| **Egress** | `count_out` | Hiển thị trực tiếp |
| **Alert** | `alert` | Hiển thị cấp độ cảnh báo |

### Objects Array

| Field | Type | Mô tả |
|-------|------|--------|
| `track_id` | int | ID theo dõi duy nhất cho mỗi người (`HUMAN #101`) |
| `bbox` | int[4] | `[x1, y1, x2, y2]` — pixel tuyệt đối trên ảnh gốc |
| `coordinates_2D` | int[2] | `[x, y]` — pixel trên bản đồ 2D |

### Alert Levels

| Value | Mô tả |
|-------|--------|
| `"none"` | Bình thường |
| `"info"` | Ghi nhận bất thường |
| `"warning"` | Số người ≥ warning threshold |
| `"critical"` | Số người ≥ critical threshold |

> [!IMPORTANT]
> `bbox` và `coordinates_2D` đều là tọa độ **pixel**. FE chia cho kích thước tương ứng để chuyển sang %.

> [!NOTE]
> `save_to_db: true` = BE đã lưu vào DB (cho History). `false` = chỉ forward realtime.

---

# Tab 2 — Analytics (`/analytics`)

Dashboard phân tích occupancy, traffic patterns, và heatmap.

> [!NOTE]
> Layout khuyến nghị: **Top** = KPI Cards → **Middle** = Line Chart + Donut → **Bottom** = Heatmap + Bar Chart

---

## `GET /api/lab_management/analytics/summary?period={period}`

KPI cards tổng quan. `period`: `1h` · `today` · `7d` · `30d`

```json
{
  "current_occupancy": 42,
  "peak_occupancy": 84,
  "peak_time": "14:30",
  "avg_dwell_time_minutes": 23.5,
  "total_in": 847,
  "total_out": 743,
  "net_flow": 104
}
```

| Field → UI |
|------------|
| `total_in` → KPI "Entry" |
| `total_out` → KPI "Exit" |
| `current_occupancy` → KPI "Occupancy" (featured) |
| `peak_occupancy` + `peak_time` → KPI "Peak Hour" |
| `avg_dwell_time_minutes` → KPI "Avg Dwell Time" |

---

## `GET /api/lab_management/analytics/occupancy-trends?period={period}`

Line chart: occupancy, ingress, egress theo thời gian. Hỗ trợ so sánh hôm nay vs hôm qua.

```json
{
  "current": [
    { "time": "00:00", "occupancy": 12, "ingress": 5, "egress": 3 },
    { "time": "01:00", "occupancy": 8, "ingress": 2, "egress": 6 }
  ],
  "previous": [
    { "time": "00:00", "occupancy": 15, "ingress": 7, "egress": 4 },
    { "time": "01:00", "occupancy": 10, "ingress": 3, "egress": 8 }
  ]
}
```

> [!TIP]
> FE vẽ `current` nét liền, `previous` nét đứt mờ → dễ dàng so sánh trend.

---

## `GET /api/lab_management/analytics/heatmap?period={period}`

Heatmap 24h × 7 ngày. `intensity`: 0.0 → 1.0.

```json
{
  "data": [
    { "day": "Mon", "hours": [0.05, 0.03, 0.02, 0.02, 0.08, 0.25, 0.55, 0.72, 0.85, 0.92, 0.88, 0.78, 0.82, 0.75, 0.68, 0.62, 0.70, 0.65, 0.45, 0.38, 0.30, 0.22, 0.15, 0.08] },
    { "day": "Tue", "hours": [0.04, 0.02, 0.01, 0.02, 0.10, 0.30, 0.60, 0.75, 0.88, 0.95, 0.90, 0.80, 0.85, 0.78, 0.70, 0.65, 0.72, 0.68, 0.48, 0.40, 0.32, 0.25, 0.18, 0.10] }
  ]
}
```

> [!NOTE]
> Mỗi `hours` array có 24 phần tử (0h → 23h). Heatmap grid: rows = ngày, cols = giờ.

---

## `GET /api/lab_management/analytics/traffic-daily?period={period}`

Bar chart: traffic theo từng ngày trong tuần.

```json
{
  "data": [
    { "day": "Mon", "total_in": 120, "total_out": 115 },
    { "day": "Tue", "total_in": 145, "total_out": 138 },
    { "day": "Wed", "total_in": 160, "total_out": 152 }
  ]
}
```

---

## `GET /api/lab_management/analytics/flow-ratio?period={period}`

Donut chart: tỷ lệ Entry vs Exit và phân tích dwell time.

```json
{
  "entry_exit": {
    "total_in": 847,
    "total_out": 743,
    "in_percentage": 53.3,
    "out_percentage": 46.7
  },
  "dwell_distribution": [
    { "range": "< 5 min", "percentage": 25 },
    { "range": "5-15 min", "percentage": 35 },
    { "range": "15-30 min", "percentage": 25 },
    { "range": "> 30 min", "percentage": 15 }
  ]
}
```

---

## `GET /api/lab_management/analytics/peak-daily?period={period}`

Bar chart: peak occupancy đạt được mỗi ngày. Highlight khi vượt threshold.

```json
{
  "data": [
    { "day": "Mon", "peak": 72, "time": "14:30" },
    { "day": "Tue", "peak": 85, "time": "10:15" },
    { "day": "Wed", "peak": 94, "time": "14:00" }
  ]
}
```

---

## `GET /api/lab_management/analytics/cumulative-traffic?period={period}`

Area chart: tích lũy entry/exit trong ngày — thể hiện tốc độ lấp đầy.

```json
{
  "data": [
    { "time": "00:00", "cumulative_in": 0, "cumulative_out": 0 },
    { "time": "08:00", "cumulative_in": 150, "cumulative_out": 82 },
    { "time": "14:00", "cumulative_in": 620, "cumulative_out": 475 }
  ]
}
```

---

## `GET /api/lab_management/analytics/dwell-by-hour?period={period}`

Line chart: avg dwell time theo giờ — tìm ra lúc nào visitors ở lại lâu nhất.

```json
{
  "data": [
    { "time": "06:00", "avg_dwell": 8 },
    { "time": "10:00", "avg_dwell": 28 },
    { "time": "14:00", "avg_dwell": 42 }
  ]
}
```

---

## `GET /api/lab_management/analytics/export?period={period}`

Export CSV report chứa tất cả analytics data.

**Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="analytics_report_{period}_{date}.csv"`

> [!NOTE]
> FE cũng có thể tự tạo CSV client-side từ data đang có mà không cần gọi endpoint này.

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

# Tab 5 — Settings (`/settings`)

Cấu hình hệ thống: ngưỡng cảnh báo, thông số camera, và **2D Mapping Calibration** (homography).

---

## `POST /api/lab_management/settings/mapping` ⭐ Calibration

Gửi tập hợp các shape đã được đánh dấu tương ứng giữa camera frame và floor plan để BE tính toán **ma trận homography**. BE dùng matrix này để chuyển đổi tọa độ pixel của objects từ camera sang tọa độ 2D trên bản đồ.

> [!IMPORTANT]
> Cần tối thiểu **4 shape** (khuyến nghị là 4 điểm `point` không thẳng hàng) để tính homography chính xác.

### Request Body

```json
{
  "shapes": [
    {
      "type": "point",
      "camera":     [[485, 312]],
      "floor_plan": [[200, 150]]
    },
    {
      "type": "point",
      "camera":     [[820, 290]],
      "floor_plan": [[600, 145]]
    },
    {
      "type": "point",
      "camera":     [[910, 530]],
      "floor_plan": [[620, 420]]
    },
    {
      "type": "point",
      "camera":     [[310, 580]],
      "floor_plan": [[180, 430]]
    },
    {
      "type": "line",
      "camera":     [[200, 200], [900, 200]],
      "floor_plan": [[100, 100], [700, 100]]
    }
  ]
}
```

### Schema — Shape Object

| Field | Type | Mô tả |
|-------|------|--------|
| `type` | string | `"point"` · `"line"` |
| `camera` | int\[2\]\[\] | Mảng toạ độ `[x, y]` pixel trên **camera frame** |
| `floor_plan` | int\[2\]\[\] | Mảng toạ độ `[x, y]` pixel trên **floor plan image** |

#### Số điểm theo `type`

| `type` | `camera` | `floor_plan` | Mô tả |
|--------|----------|--------------|-------|
| `point` | 1 điểm `[[x, y]]` | 1 điểm `[[x, y]]` | Điểm tương ứng đơn lẻ |
| `line`  | 2 điểm `[[x1,y1],[x2,y2]]` | 2 điểm `[[x1,y1],[x2,y2]]` | Đoạn thẳng — cặp điểm Start + End |

> [!NOTE]
> `camera` và `floor_plan` **luôn có cùng số điểm**. FE đảm bảo điều này: mỗi shape được label theo thứ tự camera → floor plan trước khi gửi.

### Tọa độ

| Nguồn | Gốc | Đơn vị |
|-------|-----|--------|
| `camera` | `(0, 0)` = góc trên-trái của camera frame | pixel, tham chiếu `width_frame × height_frame` (thường 1280 × 720) |
| `floor_plan` | `(0, 0)` = góc trên-trái của ảnh floor plan | pixel, tham chiếu kích thước ảnh `/labmap.svg` |

### Response — Thành công `200 OK`

```json
{
  "status": "ok",
  "updated_at": "2026-03-06T10:00:00Z"
}
```

### Response — Lỗi

| HTTP | Trường hợp |
|------|-----------|
| `400` | Ít hơn 4 shape · thiếu field · tọa độ nằm ngoài kích thước ảnh |
| `422` | Các điểm thẳng hàng (không tính được homography) |
| `500` | Lỗi tính toán ma trận homography phía BE |

```json
// 400
{ "error": { "code": "BAD_REQUEST", "message": "At least 4 shapes required for homography" } }

// 422
{ "error": { "code": "UNPROCESSABLE", "message": "Points are collinear, cannot compute homography" } }
```

### Flow hoàn chỉnh từ FE

```
1. User mở "Open Calibration" → modal hiện ra
2. User chọn tool (Point / Line) và đánh dấu cặp điểm trên Camera Frame + Floor Plan
3. Lặp lại cho đến khi đủ ≥ 4 shapes
4. Nhấn "Apply" → FE gọi POST /settings/mapping
        ↓
   Body: { shapes: [ { type, camera: [[px,py],...], floor_plan: [[px,py],...] } ] }
        ↓
   BE nhận → tính homography matrix → lưu vào config
        ↓
   BE dùng matrix mới ngay trong pipeline xử lý frame tiếp theo
5. FE nhận 200 → hiển thị thông báo thành công
```

> [!TIP]
> Để calibration chính xác: chọn các điểm **phân bố đều**, bao phủ toàn bộ vùng quan sát — tránh chọn điểm gom cụm vào một góc.

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
| **`wss://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net/ws/frontend/frames/`** | Frame data (ảnh binary JPEG, bbox, 2D, count) | ~30fps |

> [!NOTE]
> Endpoint thực tế đang dùng là URL Azure ở trên, **không phải** `/api/lab_management/ws/frames` như đã ghi trong docs ban đầu.  
> FE set `ws.binaryType = 'arraybuffer'` để nhận **raw binary JPEG** (không phải base64). Nếu message là string, parse JSON để lấy `frame_image` (base64 fallback).

## Rate Limits

| Loại | Giới hạn |
|------|---------|
| REST | 100 req/min |
| WebSocket | 50 concurrent |
