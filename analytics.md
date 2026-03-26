
---

# 1. Backend (BE)

**Mục tiêu:** xử lý dữ liệu, tối ưu request, phục vụ nhanh

* **Ingest data qua Queue** (Kafka / RabbitMQ) → tránh ghi DB trực tiếp
* **Aggregation service**: gom dữ liệu theo nhiều mức (1m, 1h, 1d)
* **Pre-aggregated DB** (tránh query raw)
* **Cache bằng Redis** cho các query phổ biến
* **Push data bằng WebSocket** thay vì FE polling
* **Chỉ gửi delta update**, không gửi full data

👉 Kết quả: giảm load DB + giảm request + real-time mượt

---

# 2. AI (Processing / Analytics logic)

**Mục tiêu:** tạo insight từ dữ liệu tracking

* Xử lý **raw tracking → event (đếm người, hành vi, di chuyển)**
* Tính toán:

  * density (mật độ)
  * flow (luồng di chuyển)
  * dwell time (thời gian dừng)
* Output thành **metrics đã xử lý sẵn** (không để BE tính lại)
* Có thể chạy:

  * real-time (stream processing)
  * batch (tính lại dữ liệu lịch sử)

👉 Kết quả: BE chỉ đọc dữ liệu đã “clean + ready”

---

# 3. Frontend (FE)

**Mục tiêu:** hiển thị mượt, ít request

* Nhận data qua WebSocket (real-time)
* **Không poll API liên tục**
* Render theo:

  * nhiều time range (1h, 1d, 1m…) → gọi đúng loại data aggregate
* **Append data (delta)** thay vì re-render toàn bộ chart
* Downsample dữ liệu khi nhiều điểm
* Cache phía client (tránh gọi lại)

👉 Kết quả: UI mượt + giảm request + scale tốt

---

# 4. Đồng bộ trong repo (hiện tại)

| Lớp | Đã triển khai |
|-----|----------------|
| **BE** | Truy vấn analytics dùng `annotate(Count('detections'))` thay cho vòng lặp N+1 (summary, heatmap, peak-daily, export CSV). Response JSON: `Cache-Control: private, max-age=30` (browser/proxy ngắn hạn; không thay Redis). |
| **FE** | `useAnalyticsData`: cache in-memory theo `period` (TTL 45s), `AbortController` hủy request khi đổi time range, `refetch(true)` bỏ cache (nút Retry). Không polling — chỉ fetch khi đổi period hoặc refresh. |

Chi tiết API: `backend/ANALYTICS_API.md`.

---