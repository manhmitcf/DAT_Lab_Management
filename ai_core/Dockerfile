FROM nvcr.io/nvidia/deepstream:7.0-triton-multiarch

# Set non-interactive to avoid prompts during apt-get
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Set primary working directory
WORKDIR /workspace/ai_core

# =========================================================
# 1. Install System Dependencies (Least frequent change)
# =========================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget git cmake curl \
    build-essential pkg-config \
    # Python & OpenCV Tools
    python3-opencv python3-pip python3-dev \
    # Python GStreamer Bindings & C++ Headers for pip compiling PyCairo/PyGObject on ARM64
    python3-gi python3-gst-1.0 gir1.2-gst-plugins-base-1.0 \
    libcairo2-dev libgirepository1.0-dev \
    # OpenCV Dev Headers (Required for C++ Tracker & Metric Probe)
    libopencv-dev \
    # GStreamer & GLib Dev Headers (Required for C++ Makefile compilation)
    libglib2.0-dev libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev \
    # Eigen3 (Required for OCSort CMake compilation)
    libeigen3-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# =========================================================
# 2. Install PYDS (DeepStream Python Bindings for DS 7.0)
# =========================================================
RUN pip3 install --upgrade pip \
    && wget https://github.com/NVIDIA-AI-IOT/deepstream_python_apps/releases/download/v1.1.11/pyds-1.1.11-py3-none-linux_aarch64.whl \
    && pip3 install pyds-1.1.11-py3-none-linux_aarch64.whl \
    && rm pyds-1.1.11-py3-none-linux_aarch64.whl

# =========================================================
# 3. Configure PIP and Install Core Python Dependencies
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
# 4. Copy Application Code
# =========================================================
# (Unnecessary folders will be excluded via .dockerignore)
COPY . .

# =========================================================
# 5. Create Necessary Directories
# =========================================================
RUN mkdir -p pretrained videos YOLOX_outputs weights config

# =========================================================
# 6. Build C++ Extensions (Custom YOLOX Parser + OCSort NvMOT + Probe)
# =========================================================
# Compile the custom YOLOX BBox parser for DeepStream (libnvdsinfer_custom_impl_YoloX.so)
RUN cd deploy/DeepStream && make || echo "Warning: YoloX Makefile failed."

# Compile the OCSort Tracker wrapped in NvMOT API (libnvds_ocsort.so)
RUN cd deploy/OCSort/cpp && mkdir -p build && cd build && cmake .. && make || echo "Warning: OCSort CMake failed."

# Compile the Custom C++ Counting & Mapping Probe (libcounting_mapping.so)
RUN cd deploy/DeepStream/cpp_logic && make || echo "Warning: C++ Metric Probe Makefile failed."

# =========================================================
# 7. Setup Project in Editable Mode
# =========================================================
# Install setup.py to build C++ extensions (e.g., YOLOX/OCSort Python bindings if any)
RUN pip3 install --no-build-isolation -e .

# =========================================================
# 8. Default Command
# =========================================================
CMD ["python3", "deepstream_app.py"]
