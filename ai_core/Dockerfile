# =========================================================
# Base image cho Jetson Nano (JetPack 4.x - Ubuntu 18.04)
# =========================================================
FROM nvcr.io/nvidia/l4t-pytorch:r32.7.1-pth1.10-py3

# =========================================================
# Environment
# =========================================================
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace/ai_core

# =========================================================
# 1. FIX repo lỗi + cài system dependencies
# =========================================================
RUN sed -i '/apt.kitware.com/d' /etc/apt/sources.list || true && \
    rm -rf /etc/apt/sources.list.d/* || true && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    wget git curl build-essential pkg-config ninja-build \
    cmake \
    libgl1-mesa-glx libglib2.0-0 \
    python3-opencv python3-pip python3-dev libopencv-dev \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# =========================================================
# 2. Copy requirements
# =========================================================
COPY requirements.txt .

# =========================================================
# 3. Remove incompatible packages (x86 / CUDA mismatch)
# =========================================================
RUN sed -i '/torch/d' requirements.txt && \
    sed -i '/torchvision/d' requirements.txt && \
    sed -i '/onnxruntime/d' requirements.txt

# =========================================================
# 4. Python dependencies
# =========================================================
RUN pip3 install --upgrade pip setuptools wheel && \
    pip3 install cython && \
    pip3 install pycocotools cython_bbox && \
    pip3 install --no-cache-dir -r requirements.txt

# =========================================================
# 5. Copy source code
# =========================================================
COPY . .

# =========================================================
# 6. Setup project
# =========================================================
RUN mkdir -p pretrained videos YOLOX_outputs

# Build YOLOX
RUN pip3 install --no-build-isolation -e .