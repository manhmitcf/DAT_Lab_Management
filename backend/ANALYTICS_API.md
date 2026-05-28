# Analytics API Documentation

API phân tích occupancy, traffic và dwell time cho hệ thống Lab Management. Tính toán trực tiếp từ database (PostgreSQL/SQLite) với truy vấn đã tối ưu (`annotate` / `Count`). Response JSON có **`Cache-Control: private, max-age=30`** (cache ngắn hạn phía client; không dùng Redis trên server).

---

## Base URL

```
/api/lab_management/analytics/
```

## Query Parameter: `period`

Hầu hết endpoint dùng query param `period` để chọn khoảng thời gian:

| Giá trị | Mô tả |
|--------|-------|
| `1h` | 1 giờ qua |
| `today` | Từ 00:00 UTC hôm nay đến hiện tại |
| `7d` | 7 ngày qua |
| `30d` | 30 ngày qua |

Giá trị không hỗ trợ → mặc định là `today`.

---

## Endpoints

### 1. Summary — KPI Cards

**`GET /api/lab_management/analytics/summary`**

Tổng hợp KPIs: occupancy hiện tại, peak, avg dwell, tổng vào/ra.

**Query params:** `period` (default: `today`)

**Response:**
```json
{
  "current_occupancy": 7,
  "peak_occupancy": 7,
  "peak_time": "14:00",
  "avg_dwell_time_minutes": 351.4,
  "total_in": 38,
  "total_out": 19,
  "net_flow": 19
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `current_occupancy` | int | Số người hiện tại (detections của frame gần nhất) |
| `peak_occupancy` | int | Số người cao nhất trong period |
| `peak_time` | string \| null | Thời điểm peak (HH:MM) |
| `avg_dwell_time_minutes` | float | Thời gian lưu trú trung bình (phút) theo track_id |
| `total_in` | int | Tổng lượt vào (từ cumulative count_in) |
| `total_out` | int | Tổng lượt ra |
| `net_flow` | int | total_in - total_out |

---

### 2. Occupancy Trends — Line Chart

**`GET /api/lab_management/analytics/occupancy-trends`**

Xu hướng occupancy, ingress, egress theo giờ — so sánh current vs previous period.

**Query params:** `period` (default: `today`)

**Response:**
```json
{
  "current": [
    { "time": "08:00", "occupancy": 13, "ingress": 26, "egress": 13 },
    { "time": "09:00", "occupancy": 14, "ingress": 2, "egress": 1 }
  ],
  "previous": [
    { "time": "08:00", "occupancy": 10, "ingress": 20, "egress": 10 }
  ]
}
```

| Field | Mô tả |
|-------|-------|
| `time` | Giờ (HH:00) |
| `occupancy` | count_in - count_out tại thời điểm đó |
| `ingress` | Tăng count_in so với giờ trước |
| `egress` | Tăng count_out so với giờ trước |

`previous` là period trước đó có cùng độ dài (vd: period=today → previous = hôm qua).

---

### 3. Heatmap — 24h × 7 Days

**`GET /api/lab_management/analytics/heatmap`**

Heatmap cường độ theo ngày trong tuần × giờ (Mon–Sun × 00:00–23:00).

**Query params:** `period` (default: `7d`)

**Response:**
```json
{
  "data": [
    {
      "day": "Mon",
      "hours": [0.0, 0.0, 0.12, 0.0, 0.0, 0.35, 0.8, 1.0, 0.9, 0.7, ...]
    },
    { "day": "Tue", "hours": [...] }
  ]
}
```

- `hours`: 24 phần tử, mỗi phần tử là intensity **0.0–1.0** (normalized theo max trong period).
- Thứ tự ngày: Mon=0, Tue=1, ..., Sun=6.

---

### 4. Traffic Daily — Bar Chart by Weekday

**`GET /api/lab_management/analytics/traffic-daily`**

Traffic theo ngày trong tuần (Mon–Sun).

**Query params:** `period` (default: `7d`)

**Response:**
```json
{
  "data": [
    { "day": "Mon", "total_in": 46, "total_out": 24 },
    { "day": "Tue", "total_in": 45, "total_out": 23 }
  ]
}
```

---

### 5. Flow Ratio — Donut Chart

**`GET /api/lab_management/analytics/flow-ratio`**

Tỷ lệ entry/exit và phân bố dwell time.

**Query params:** `period` (default: `today`)

**Response:**
```json
{
  "entry_exit": {
    "total_in": 38,
    "total_out": 19,
    "in_percentage": 66.7,
    "out_percentage": 33.3
  },
  "dwell_distribution": [
    { "range": "< 5 min", "percentage": 10 },
    { "range": "5-15 min", "percentage": 25 },
    { "range": "15-30 min", "percentage": 30 },
    { "range": "> 30 min", "percentage": 35 }
  ]
}
```

---

### 6. Peak Daily — Bar Chart

**`GET /api/lab_management/analytics/peak-daily`**

Peak occupancy theo từng ngày trong period.

**Query params:** `period` (default: `7d`)

**Response:**
```json
{
  "data": [
    { "day": "Thu", "peak": 7, "time": "14:00" },
    { "day": "Fri", "peak": 6, "time": "10:30" }
  ]
}
```

---

### 7. Cumulative Traffic — Area Chart

**`GET /api/lab_management/analytics/cumulative-traffic`**

Tích lũy count_in / count_out theo giờ.

**Query params:** `period` (default: `today`)

**Response:**
```json
{
  "data": [
    { "time": "08:00", "cumulative_in": 26, "cumulative_out": 13 },
    { "time": "09:00", "cumulative_in": 28, "cumulative_out": 14 }
  ]
}
```

---

### 8. Export — CSV Download

**`GET /api/lab_management/analytics/export`**

Export raw analytics data dạng CSV.

**Query params:** `period` (default: `today`)

**Response:** `Content-Type: text/csv`, file download

**Headers:**
```text
timestamp,count_in,count_out,alert,num_detections,height_frame,width_frame
```

**Filename:** `analytics_report_{period}_{YYYYMMDD}.csv`

---

## Period Compatibility

| Endpoint | 1h | today | 7d | 30d |
|----------|----|-------|----|-----|
| summary | ✓ | ✓ | ✓ | ✓ |
| occupancy-trends | ✓ | ✓ | ✓ | ✓ |
| heatmap | ✓ | ✓ | ✓ (recommended) | ✓ |
| traffic-daily | ✓ | ✓ | ✓ (recommended) | ✓ |
| flow-ratio | ✓ | ✓ | ✓ | ✓ |
| peak-daily | ✓ | ✓ | ✓ (recommended) | ✓ |
| cumulative-traffic | ✓ | ✓ | ✓ | ✓ |
| export | ✓ | ✓ | ✓ | ✓ |

---

## Seed Test Data

Để tạo dữ liệu giả cho testing:

```bash
cd backend
python manage.py seed_analytics_data --clear --days 7
```

- `--clear`: Xóa FrameData hiện có trước khi seed
- `--days N`: Số ngày cần tạo (mặc định: 7)

---

## Data Source

- **Models:** `FrameData`, `ObjectDetection` (PostgreSQL/SQLite)
- **Computation:** Real-time, truy vấn trực tiếp qua Django ORM mỗi request
- **Caching:** Không sử dụng cache hay Redis cho analytics

---

## Example cURL

```bash
# Summary
curl "http://127.0.0.1:8000/api/lab_management/analytics/summary?period=today"

# Occupancy trends
curl "http://127.0.0.1:8000/api/lab_management/analytics/occupancy-trends?period=7d"

# Export CSV
curl -o report.csv "http://127.0.0.1:8000/api/lab_management/analytics/export?period=today"
```
