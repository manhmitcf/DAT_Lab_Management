# Sử dụng base image chính thức của Nvidia dành cho Jetson (Jetpack 6.x) đã cài sẵn PyTorch 2.2
# Image này tương thích hoàn hảo với Jetson Orin Nano 8GB
FROM nvcr.io/nvidia/l4t-pytorch:r32.7.1-pth1.10-py3

# Tránh bị hỏi tương tác khi cài apt-get
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace/ai_core

# =========================================================
# 1. Cài đặt System Dependencies cho Ubuntu 22.04 (Jetpack 6)
# =========================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget git cmake curl build-essential pkg-config ninja-build \
    # Các thư viện xử lý ảnh (OpenCV)
    libgl1-mesa-glx libglib2.0-0 \
    python3-opencv python3-pip python3-dev libopencv-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# =========================================================
# 2. Xử lý Requirements cho kiến trúc ARM64 của Jetson
# =========================================================
# Copy requirements.txt hiện tại vào trước
COPY requirements.txt .

# LƯU Ý QUAN TRỌNG: 
# Thư viện torch==1.9.1+cu111 và torchvision trong requirements.txt là bản x86 (của máy tính bàn).
# Cài đặt trên Jetson ARM64 bằng pip sẽ dẫn đến lỗi không tìm thấy package.
# Vì base image 'l4t-pytorch' đã CÓ SẴN PyTorch và Torchvision tối ưu hoàn toàn cho Jetson,
# Ta dùng 'sed' xóa đi các dòng này khỏi file requirements.txt trước khi pip install
RUN sed -i '/torch==/d' requirements.txt && \
    sed -i '/torch>=/d' requirements.txt && \
    sed -i '/torchvision/d' requirements.txt && \
    sed -i '/onnxruntime==/d' requirements.txt

# =========================================================
# 3. Cài đặt Python Dependencies
# =========================================================
RUN pip3 install --upgrade pip setuptools wheel && \
    pip3 install cython && \
    pip3 install pycocotools cython_bbox && \
    pip3 install onnxruntime-gpu --extra-index-url https://pypi.ngc.nvidia.com && \
    pip3 install --no-cache-dir -r requirements.txt

# =========================================================
# 4. Copy Mã Nguồn Của Dự Án
# =========================================================
COPY . .

# =========================================================
# 5. Tạo Thư Mục Cần Thiết & Build YOLOX
# =========================================================
RUN mkdir -p pretrained videos YOLOX_outputs

# Cài đặt YOLOX và build các C++ extensions nội bộ của YOLO (setup.py)
RUN pip3 install --no-build-isolation -e .

# =========================================================
# 6. Lệnh Chạy Ứng Dụng Mặc Định
# =========================================================
# Kích hoạt project chạy file main.py thay vì deepstream
CMD ["python3", "main.py"]
