# Base image with PyTorch and torch2trt pre-installed for JetPack 6 (ARM64)
FROM dustynv/torch2trt:r36.4.0-cu128-24.04

# Set non-interactive to avoid stuck during apt-get
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Set primary working directory
WORKDIR /workspace/ai_core

# =========================================================
# 1. Install System Dependencies (Least frequent change)
# =========================================================
RUN apt-get update && apt-get install -y \
    git cmake curl wget vim nano build-essential \
    libglib2.0-0 \
    protobuf-compiler libprotoc-dev \
    libgl1 libglx-mesa0 libegl1 libgles2 \
    python3-opencv \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# =========================================================
# 2. Configure PIP and Install Core Python Dependencies
# =========================================================
COPY requirements.txt .
ENV PIP_INDEX_URL=https://pypi.org/simple
ENV PIP_EXTRA_INDEX_URL=""

RUN rm -f /etc/pip.conf \
    && pip3 install --upgrade pip setuptools wheel \
    && pip3 install cython \
    && pip3 install pycocotools \
    && pip3 install cython_bbox \
    && pip3 install ninja \
    && pip3 install --no-cache-dir -r requirements.txt

# =========================================================
# 3. Copy Application Code
# =========================================================
COPY . .

# =========================================================
# 4. Create Necessary Directories
# =========================================================
RUN mkdir -p pretrained videos YOLOX_outputs weights config

# =========================================================
# 5. Setup Project in Editable Mode
# =========================================================
# Install setup.py (to build C++ extensions of YOLOX/OCSort if any)
RUN pip3 install --no-build-isolation -e .

# =========================================================
# 6. Default Command
# =========================================================
CMD ["python3", "main.py"]
