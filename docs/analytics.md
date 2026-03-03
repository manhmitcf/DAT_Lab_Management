
---

# 1️⃣ Line Chart (Biểu đồ đường – theo thời gian)

Phù hợp cho dữ liệu time-series.

### 📊 Có thể show:

* Occupancy theo thời gian (real-time & historical)
* Entry / Exit theo giờ
* Net Flow (In - Out)
* Average Dwell Time theo giờ
* Density (người/m²) theo thời gian
* FPS / Latency theo thời gian

👉 Insight trực quan:

* Nhìn thấy peak hour ngay lập tức
* So sánh hôm nay vs hôm qua (2 line chồng nhau)
* Phát hiện spike bất thường

---

# 2️⃣ Bar Chart / Column Chart (So sánh)

Phù hợp khi so sánh giữa zone hoặc nhóm.

### 📊 Có thể show:

* Số người theo từng Zone
* Dwell Time trung bình theo Zone
* Entry count theo cửa
* Group size distribution (1 người, 2 người, 3+ người)
* Traffic theo ngày trong tuần
* ID switch theo camera (multi-cam)

👉 Insight:

* Zone nào đông nhất?
* Cửa nào hoạt động mạnh nhất?
* Thứ nào cao điểm?

---

# 3️⃣ Area Chart (Tăng cảm giác mật độ)

Phù hợp cho:

* Occupancy accumulation
* Traffic build-up trong ngày
* Cumulative Entry

👉 Insight:

* Tốc độ lấp đầy không gian
* Chu kỳ tăng–giảm rõ ràng

---

# 4️⃣ Pie Chart / Donut Chart (Tỷ lệ)

Dùng khi cần phân bổ %.

### 📊 Có thể show:

* Entry vs Exit %
* Short stay vs Long stay %
* Unique vs Returning %
* Individual vs Group %
* Direction distribution (% trái/phải/trước/sau)

👉 Insight:

* Hành vi chiếm ưu thế
* Mất cân bằng flow

---

# 5️⃣ Histogram (Phân phối)

Phù hợp khi phân tích hành vi.

### 📊 Có thể show:

* Dwell time distribution
* Speed distribution
* Session duration distribution
* Tracking confidence distribution

👉 Insight:

* Phần lớn người ở dưới 10 phút?
* Có outlier dwell time?

---

# 6️⃣ Heatmap (Không gian hoặc thời gian)

![Image](https://miro.medium.com/1%2APLsbivOVC_TU6scpJv12pg.gif)

![Image](https://img.thingsboard.io/trendz/guide/building_occupancy/hotel_weakly_occupansy_heatmap.png)

![Image](https://www.researchgate.net/publication/325433910/figure/fig1/AS%3A649235250835456%401531801154806/Heatmap-generated-by-Walkbase-tracking-product-showing-customer-movement-in-a-retail.png)

![Image](https://cdn.labellerr.com/1%20Applications%20of%20CV%20based%20heat%20map%20in%20retail/img4.webp)

### 📊 Có thể show:

### 🔥 Spatial Heatmap

* Mật độ người theo vị trí
* Khu vực đông nhất
* Dead zones

### 🔥 Time Heatmap (24h x 7 ngày)

* Giờ cao điểm theo từng ngày
* Pattern lặp lại

👉 Insight:

* Bottleneck area
* Peak hour cố định

---

# 7️⃣ Trajectory Visualization (Đường đi)

### 📊 Có thể show:

* All trajectories overlay
* Clustered main paths
* Entry → Exit flow lines
* Sankey Diagram (Zone transition)

👉 Insight:

* Hướng di chuyển phổ biến
* Transition mạnh giữa zone nào

---

# 8️⃣ Scatter Plot

Phù hợp để tìm correlation.

### 📊 Có thể show:

* Dwell time vs Speed
* Occupancy vs FPS
* Density vs ID Switch Rate
* Group size vs Dwell time

👉 Insight:

* Mật độ cao làm FPS giảm?
* Nhóm đông ở lại lâu hơn?

---

# 9️⃣ Box Plot (Phân tích outlier)

### 📊 Có thể show:

* Dwell time per zone
* Speed per zone
* Session duration by day

👉 Insight:

* Zone nào có nhiều outlier?
* Ngày nào có hành vi bất thường?

---

# 🔟 Gauge / KPI Card (Real-time dashboard)

Không phải biểu đồ truyền thống nhưng rất quan trọng:

* Current Occupancy
* Density Risk Level
* Congestion Score
* System Health Score

---

# 🎯 Nếu bạn muốn dashboard nhìn “Product AI”

Một layout mạnh sẽ có:

### Top row:

* KPI Cards (Occupancy, Peak, Avg Dwell)

### Middle:

* Line Chart (Occupancy theo thời gian)
* Bar Chart (Zone comparison)

### Bottom:

* Heatmap (Spatial)
* Histogram (Dwell distribution)
* Sankey (Zone transitions)

---

# 🧠 Insight có thể visualize được

| Insight                         | Biểu đồ phù hợp |
| ------------------------------- | --------------- |
| Peak hour                       | Line chart      |
| Zone đông nhất                  | Bar chart       |
| Phân bố thời gian lưu           | Histogram       |
| Hướng di chuyển                 | Pie / Sankey    |
| Bottleneck                      | Heatmap         |
| Mối quan hệ mật độ vs hiệu năng | Scatter         |
