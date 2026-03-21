# EdgeSentinelAI — API Documentation

> **Version:** 3.2.0 · **Updated:** 2026-03-21  
> **Backend Base URL:** `https://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net`  
> **REST prefix:** `/api/lab_management` · **Format:** JSON  
> **Hệ thống:** 1 camera duy nhất — video qua WebRTC/Janus, metadata & config qua WebSocket.

---

## Quick Reference — Tất cả Endpoints

| # | Method | Endpoint | FE Status | Mô tả ngắn |
|---|--------|----------|-----------|------------|
| — | WS | `wss://.../ws/persist/metadata/` | ✅ Implemented | Metadata realtime (edge → FE) |
| — | WS | `wss://.../ws/settings/mapping/` | ✅ Implemented | Calibration mapping (FE → edge) |
| — | WS | `wss://.../ws/settings/counting/` | ✅ Implemented | Counting line config (FE → edge) |
| 1 | GET | `/analytics/summary` | ✅ API | KPI cards |
| 2 | GET | `/analytics/occupancy-trends` | ✅ API | Line chart |
| 3 | GET | `/analytics/heatmap` | ✅ API | Heatmap 24×7 |
| 4 | GET | `/analytics/traffic-daily` | ✅ API | Bar chart ngày |
| 5 | GET | `/analytics/flow-ratio` | ✅ API | Donut entry/exit |
| 6 | GET | `/analytics/peak-daily` | ✅ API | Bar chart peak |
| 7 | GET | `/analytics/cumulative-traffic` | ✅ API | Area chart tích lũy |
| 8 | GET | `/analytics/export` | ✅ API | Export CSV |
| 9 | GET | `/alerts` | 🔄 Mock | Danh sách cảnh báo |
| 10 | GET | `/alerts/{id}/video` | 🚧 Planned | Video clip cảnh báo |
| 11 | PUT | `/alerts/threshold` | 🚧 Planned | Cấu hình ngưỡng |
| 12 | GET | `/history/recordings` | 🔄 Mock | Danh sách recordings |
| 13 | GET | `/history/recordings/{id}/stream` | 🚧 Planned | Video playback |

> **Legend:** ✅ FE đã implement (real API) · 🔄 FE đang dùng mock data · 🚧 Planned

---

# Tab 1 — Live Monitor (`/`)

Trang chính, hiển thị realtime: video feed, floor plan 2D, stats.

---

## WebSocket `wss://.../ws/persist/metadata/` ✅ Implemented

**Endpoint chính cho realtime metadata.** Edge Device gửi metadata mỗi frame lên BE, BE broadcast ngay tới FE. Video stream xử lý riêng qua **WebRTC/Janus** — không đi qua endpoint này.

**Full URL:**
```
wss://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net/ws/persist/metadata/
```

**FE config:** Kết nối với tư cách **Listener**. Auto-reconnect sau 5 000 ms.

### Message Format

FE nhận JSON text được BE forward từ Edge Device:

```json
{
  "timestamp":    "2026-03-11T10:00:00Z",
  "count_in":     5,
  "count_out":    2,
  "occupancy":    3,
  "alert":        "info",
  "fps":          28.5,
  "save_to_db":   true,
  "height_frame": 720,
  "width_frame":  1280,
  "height_2D":    1000,
  "width_2D":     1000,
  "objects": [
    {
      "track_id":        101,
      "bbox":            [100.5, 200.0, 150.5, 280.0],
      "coordinates_2D":  [110, 220]
    }
  ]
}
```

> [!NOTE]
> Schema khớp Pydantic `FrameData` trên BE. Không có `frame_image` trong model chuẩn; video qua WebRTC/Janus.

### FE sử dụng payload cho:

| Thành phần UI | Trường | Cách xử lý |
|---------------|--------|------------|
| **Floor Plan dots** | `objects[].coordinates_2D` + `width_2D` / `height_2D` | Chuẩn hoá % (fallback config nếu null) |
| **Occupancy KPI** | `occupancy` | Ưu tiên từ edge; fallback `objects.length` |
| **Ingress / Egress** | `count_in` / `count_out` | Hiển thị trực tiếp |
| **Alert badge** | `alert` | `none` → xanh · `info` → vàng · `warning` → cam · `critical` → đỏ |
| **Timestamp** | `timestamp` | ISO → giờ địa phương |
| **FPS** | `fps` | Dùng từ edge nếu có; không thì ước lượng client |

### Field Reference

| Field | Type | Mô tả |
|-------|------|--------|
| `timestamp` | ISO 8601 string | Thời gian UTC inference |
| `count_in` | int | Tổng người vào (cumulative) |
| `count_out` | int | Tổng người ra (cumulative) |
| `occupancy` | int | Số người hiện tại trong vùng (theo edge) |
| `alert` | string | `"none"` · `"info"` · `"warning"` · `"critical"` |
| `fps` | float \| null | FPS xử lý trên edge |
| `save_to_db` | bool | `true` = BE có thể persist (heatmap/analytics) |
| `width_frame` / `height_frame` | int \| null | Kích thước frame gốc (px) |
| `width_2D` / `height_2D` | int \| null | Kích thước bản đồ 2D (px) |
| `objects[].track_id` | int | ID theo dõi |
| `objects[].bbox` | float[4] | `[x1, y1, x2, y2]` trên frame gốc |
| `objects[].coordinates_2D` | number[2] | `[x, y]` trên floor plan |

> [!NOTE]
> `save_to_db: true` = BE đã lưu snapshot vào DB, FE có thể thấy trong History sau đó.

---

# Tab 2 — Analytics (`/analytics`) ✅ API

> [!NOTE]
> **FE gọi real API** từ backend. Fallback mock (toàn 0) khi API lỗi. Chi tiết xem `backend/ANALYTICS_API.md`.

Dashboard phân tích occupancy, traffic patterns, và heatmap.

---

## `GET /api/lab_management/analytics/summary?period={period}`

KPI cards tổng quan. `period`: `1h` · `today` · `7d` · `30d`

```json
{
  "current_occupancy":      42,
  "peak_occupancy":         84,
  "peak_time":              "14:30",
  "avg_dwell_time_minutes": 23.5,
  "total_in":               847,
  "total_out":              743,
  "net_flow":               104
}
```

| Field → UI Component |
|----------------------|
| `current_occupancy` → KPI "Occupancy" (nổi bật) |
| `total_in` → KPI "Entry" |
| `total_out` → KPI "Exit" |
| `peak_occupancy` + `peak_time` → KPI "Peak Hour" |
| `avg_dwell_time_minutes` → KPI "Avg Dwell Time" |

---

## `GET /api/lab_management/analytics/occupancy-trends?period={period}`

Line chart: occupancy, ingress, egress theo thời gian. Hỗ trợ so sánh hôm nay vs hôm qua.

```json
{
  "current": [
    { "time": "00:00", "occupancy": 12, "ingress": 5, "egress": 3 },
    { "time": "01:00", "occupancy": 8,  "ingress": 2, "egress": 6 }
  ],
  "previous": [
    { "time": "00:00", "occupancy": 15, "ingress": 7, "egress": 4 },
    { "time": "01:00", "occupancy": 10, "ingress": 3, "egress": 8 }
  ]
}
```

> [!TIP]
> FE vẽ `current` nét liền, `previous` nét đứt mờ → so sánh trend dễ dàng.

---

## `GET /api/lab_management/analytics/heatmap?period={period}`

Heatmap 24h × 7 ngày. `intensity`: 0.0 → 1.0.

```json
{
  "data": [
    { "day": "Mon", "hours": [0.05, 0.03, 0.02, 0.08, 0.25, 0.55, 0.72, 0.85, 0.92, 0.88, 0.78, 0.82, 0.75, 0.68, 0.62, 0.70, 0.65, 0.45, 0.38, 0.30, 0.22, 0.15, 0.08, 0.03] },
    { "day": "Tue", "hours": [0.04, 0.02, 0.01, 0.10, 0.30, 0.60, 0.75, 0.88, 0.95, 0.90, 0.80, 0.85, 0.78, 0.70, 0.65, 0.72, 0.68, 0.48, 0.40, 0.32, 0.25, 0.18, 0.10, 0.04] }
  ]
}
```

> `hours` có đúng 24 phần tử (index 0 = 0h, index 23 = 23h). Grid: rows = ngày, cols = giờ.

---

## `GET /api/lab_management/analytics/traffic-daily?period={period}`

Bar chart: tổng traffic (in/out) mỗi ngày trong tuần.

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

Donut chart: tỷ lệ Entry vs Exit và phân tích dwell time distribution.

```json
{
  "entry_exit": {
    "total_in":        847,
    "total_out":       743,
    "in_percentage":   53.3,
    "out_percentage":  46.7
  },
  "dwell_distribution": [
    { "range": "< 5 min",   "percentage": 25 },
    { "range": "5-15 min",  "percentage": 35 },
    { "range": "15-30 min", "percentage": 25 },
    { "range": "> 30 min",  "percentage": 15 }
  ]
}
```

---

## `GET /api/lab_management/analytics/peak-daily?period={period}`

Bar chart: peak occupancy đạt được mỗi ngày. FE highlight khi vượt critical threshold.

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
    { "time": "00:00", "cumulative_in": 0,   "cumulative_out": 0   },
    { "time": "08:00", "cumulative_in": 150, "cumulative_out": 82  },
    { "time": "14:00", "cumulative_in": 620, "cumulative_out": 475 }
  ]
}
```

---

## `GET /api/lab_management/analytics/export?period={period}` ✅ API

Export raw analytics data dạng CSV.

**Response:** `Content-Type: text/csv`  
`Content-Disposition: attachment; filename="analytics_report_{period}_{YYYYMMDD}.csv"`

**Headers:** `timestamp,count_in,count_out,alert,num_detections,height_frame,width_frame`

> FE cũng export PDF client-side (html-to-image + jsPDF). Endpoint này dùng cho download CSV từ BE.

---

# Tab 3 — Alerts (`/alerts`) 🔄 Mock

> [!WARNING]
> **FE hiện đang dùng mock data.** Các endpoint dưới đây là **API contract** cho BE.

Quản lý sự kiện bất thường. Timeline view.

---

## `GET /api/lab_management/alerts`

Lấy danh sách alerts. Hệ thống phát hiện chủ yếu **đông đúc** (Crowded) khi số người vượt ngưỡng.

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|--------|
| `type` | string | `critical` · `warning` · `info` (mặc định: all) |
| `from` | string | ISO datetime bắt đầu |
| `to`   | string | ISO datetime kết thúc |

**Response:**

```json
{
  "total": 12,
  "alerts": [
    {
      "id":         "alert-001",
      "type":       "critical",
      "event":      "Crowded",
      "start_time": "2026-02-28T14:32:15Z",
      "end_time":   "2026-02-28T14:35:15Z"
    },
    {
      "id":         "alert-002",
      "type":       "warning",
      "event":      "Crowded",
      "start_time": "2026-02-28T10:15:42Z",
      "end_time":   "2026-02-28T10:16:42Z"
    }
  ]
}
```

| Field | Type | Mô tả |
|-------|------|--------|
| `id` | string | ID duy nhất |
| `type` | string | `critical` · `warning` · `info` |
| `event` | string | Loại sự kiện (hiện tại: `Crowded`) |
| `start_time` | ISO 8601 | Bắt đầu tình trạng alert |
| `end_time` | ISO 8601 | Kết thúc tình trạng alert |

> FE tính duration = `end_time - start_time`.

---

## `GET /api/lab_management/alerts/{id}/video` 🚧 Planned

Trích xuất video clip tương ứng với khoảng thời gian của alert.

**Flow:**
```
FE: GET /alerts/alert-001/video
        ↓
BE: tra DB → alert-001.start_time, end_time
        ↓
BE: trích xuất clip từ recording (ffmpeg)
        ↓
Response: Content-Type: video/mp4 (stream)
```

> Video không lưu sẵn — chỉ trích xuất on-demand để tiết kiệm storage.

---

## `PUT /api/lab_management/alerts/threshold` 🚧 Planned

Cấu hình ngưỡng cảnh báo.

```json
// Request
{
  "warning_threshold":  30,
  "critical_threshold": 45
}

// Response 200
{
  "warning_threshold":  30,
  "critical_threshold": 45,
  "updated_at":         "2026-02-28T15:00:00Z"
}
```

| Mức | Điều kiện | Ví dụ |
|-----|-----------|-------|
| `info` | Đông bất thường, chưa vượt ngưỡng | 25 người (< 30) |
| `warning` | `count >= warning_threshold` | 35 người (≥ 30) |
| `critical` | `count >= critical_threshold` | 50 người (≥ 45) |

---

# Tab 4 — History (`/history`) 🔄 Mock

> [!WARNING]
> **FE hiện đang dùng mock data.** Các endpoint dưới đây là **API contract** cho BE.

Xem lại video và stats trong quá khứ.

---

## `GET /api/lab_management/history/recordings`

Danh sách recordings theo ngày + khoảng giờ. Giới hạn tối đa **1 tiếng** mỗi query.

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|--------|
| `date` | string | ISO date — `2026-02-28` |
| `from` | string | Giờ bắt đầu — `08:00` |
| `to`   | string | Giờ kết thúc — `09:00` (max 60 phút sau `from`) |

> [!IMPORTANT]
> Khoảng cách `from` → `to` tối đa **60 phút**. BE trả `400` nếu vượt quá.

**Response:**

```json
{
  "recordings": [
    {
      "id":              "rec-001",
      "date":            "2026-02-28",
      "time_start":      "08:00:00",
      "time_end":        "08:30:00",
      "location":        "DAT Lab",
      "thumbnail_url":   "https://...",
      "duration":        "30:00",
      "events":          12,
      "peak_occupancy":  34,
      "alerts":          1
    }
  ]
}
```

---

## `GET /api/lab_management/history/recordings/{id}/stream` 🚧 Planned

Video playback.

**Response:** `Content-Type: video/mp4` hoặc HLS manifest (`application/x-mpegURL`).

---

# Tab 5 — Settings (`/settings`)

Cấu hình Mapping Service (homography) và Counting Service (virtual tripwire) qua **WebSocket**. FE là **Sender**, Edge Device là **Listener** nhận config để áp dụng vào pipeline.

> [!NOTE]
> Cả hai settings đều dùng **WebSocket**, không phải REST.  
> FE có 2 tab trong modal Calibration: **Mapping** và **Counting**.

---

## Mapping Service ✅ Implemented

### `WS /ws/settings/mapping/`

**Full URL:**
```
wss://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net/ws/settings/mapping/
```

FE gửi cặp điểm camera ↔ floor plan, BE tính **homography matrix** và broadcast tới Edge Device.

> [!IMPORTANT]
> Cần tối thiểu **4 cặp điểm** không thẳng hàng để tính homography chính xác.

**Message gửi từ FE (Sender):**

```json
{
  "image_size": { "width": 1920, "height": 1080 },
  "map_size":   { "width": 1000, "height": 1000 },
  "correspondences": [
    { "label": "p1", "camera": [523.2,  412.8], "map": [120.5, 300.0] },
    { "label": "p2", "camera": [1020.1, 500.4], "map": [400.2, 320.6] },
    { "label": "p3", "camera": [1500.0, 800.0], "map": [800.0, 700.0] },
    { "label": "p4", "camera": [300.0,  900.0], "map": [50.0,  800.0] }
  ]
}
```

**Message nhận về:** FE nhận confirmation thành công. Edge Device nhận đúng payload trên.

**Schema:**

| Field | Type | Mô tả |
|-------|------|--------|
| `image_size.width/height` | int | Kích thước camera frame (thường 1920×1080) |
| `map_size.width/height` | int | Kích thước floor plan image |
| `correspondences[].label` | string | Auto-generated: `p1`, `p2`, ... |
| `correspondences[].camera` | float[2] | `[x, y]` px trên camera frame |
| `correspondences[].map` | float[2] | `[x, y]` px trên floor plan |

**FE UI Flow:**
```
Mapping tab → "+ Add Point"
  → click Camera Frame   (đặt điểm camera)
  → click Floor Plan     (đặt điểm map tương ứng)
  → lặp × ≥ 4 lần
→ "Apply Mapping"
  → Gửi qua WS /ws/settings/mapping/
  → BE broadcast tới Edge Device → apply homography pipeline
```

> [!TIP]
> Chọn điểm **phân bố đều** khắp vùng quan sát, tránh gom cụm vào một góc.

---

## Counting Service ✅ Implemented

### `WS /ws/settings/counting/`

**Full URL:**
```
wss://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net/ws/settings/counting/
```

FE gửi cấu hình **virtual tripwire** (đường đếm ảo), BE broadcast tới Edge Device.

**Message gửi từ FE (Sender):**

```json
{
  "line_start":      [984.47, 346.44],
  "line_end":        [903.68, 383.81],
  "inside_point":    [1001.31, 375.39],
  "crossing_margin": 10,
  "frame_height":    1080,
  "frame_width":     1920
}
```

**Message nhận về:** FE nhận confirmation thành công. Edge Device nhận đúng payload trên.

**Schema:**

| Field | Type | Mô tả |
|-------|------|--------|
| `line_start` | float[2] | `[x, y]` px — điểm **Start** của tripwire |
| `line_end` | float[2] | `[x, y]` px — điểm **End** của tripwire |
| `inside_point` | float[2] | `[x, y]` px — điểm phía **"inside"** (entry side) |
| `crossing_margin` | int | Tolerance zone (px) quanh đường, mặc định `10` |
| `frame_width` | int | Chiều rộng camera frame (thường `1920`) |
| `frame_height` | int | Chiều cao camera frame (thường `1080`) |

> [!NOTE]
> `inside_point` xác định **hướng đếm**: object đi từ phía ngoài → phía `inside_point` = đếm **"in"**.

**FE UI Flow:**
```
Counting tab → "Draw Line"
  → drag trên Camera Frame → set line_start + line_end
  → tự động chuyển sang "Inside Point"
  → click phía "entry" trên camera → set inside_point
  → điều chỉnh crossing_margin trong sidebar (default: 10)
→ "Apply Counting"
  → Gửi qua WS /ws/settings/counting/
  → BE broadcast tới Edge Device → apply counting pipeline
```

---

# Chung

## Errors

### REST Errors

Tất cả lỗi REST đều theo format:

```json
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

| HTTP | Code | Trường hợp |
|------|------|-----------|
| `400` | `BAD_REQUEST` | Request body sai / thiếu field |
| `401` | `UNAUTHORIZED` | Token không hợp lệ |
| `404` | `NOT_FOUND` | Resource không tồn tại |
| `422` | `UNPROCESSABLE` | Data hợp lệ nhưng không xử lý được (vd: điểm thẳng hàng) |
| `500` | `INTERNAL_ERROR` | Lỗi server |

### WebSocket Errors

Khi payload không hợp lệ, connection **giữ nguyên** và server trả về JSON lỗi:

**JSON syntax error:**
```json
{
  "error": {
    "code": "INVALID_JSON",
    "message": "Malformed JSON data format."
  }
}
```

**Schema validation error (thiếu field, sai kiểu):**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid data format.",
    "details": [
      { "type": "...", "loc": ["..."], "msg": "..." }
    ]
  }
}
```

## WebSocket Summary

| Endpoint | Actors | Dữ liệu | Tần suất |
|----------|--------|---------|----------|
| `.../ws/persist/metadata/` | Edge → BE → FE | JSON metadata (không có video) | ~30 fps |
| `.../ws/settings/mapping/` | FE → BE → Edge | JSON mapping config | On-demand |
| `.../ws/settings/counting/` | FE → BE → Edge | JSON counting config | On-demand |

> Video stream được xử lý riêng qua **WebRTC/Janus**, không qua các endpoint trên.  
> Auto-reconnect sau 5 000 ms khi mất kết nối.

## Rate Limits

| Loại | Giới hạn |
|------|---------|
| REST | 100 req/min |
| WebSocket | 50 concurrent connections |

## Về Mock Data

Các tab **Analytics**, **Alerts**, **History** hiện đang dùng dữ liệu giả lập (`@/lib/mockData`) trên FE.  
Khi BE implement đầy đủ các endpoint tương ứng, FE chỉ cần **thay `mockData` bằng `fetch` calls** — cấu trúc response đã được thiết kế đúng theo spec ở trên.
