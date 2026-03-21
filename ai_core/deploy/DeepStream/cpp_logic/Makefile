CUDA_VER?=12.2
ifeq ($(CUDA_VER),)
  $(error "CUDA_VER is not set")
endif

DEEPSTREAM_DIR:=/opt/nvidia/deepstream/deepstream

CC:= g++
CFLAGS:= -Wall -std=c++11 -shared -fPIC -Wno-error=deprecated-declarations

# Include directories: GStreamer, GLib, DeepStream, OpenCV
GST_INCLUDES:= $(shell pkg-config --cflags gstreamer-1.0 gstreamer-base-1.0 glib-2.0)
OPENCV_INCLUDES:= -I/usr/include/opencv4

CFLAGS+= -pthread \
         $(GST_INCLUDES) \
         $(OPENCV_INCLUDES) \
         -I$(DEEPSTREAM_DIR)/sources/includes \
         -I$(DEEPSTREAM_DIR)/sources/includes/nvdsinfer \
         -I/usr/local/cuda-$(CUDA_VER)/include

# Library dependencies
LIBS:= -L$(DEEPSTREAM_DIR)/lib -lnvdsgst_meta -lnvds_meta \
       -lopencv_core -lopencv_calib3d -lopencv_imgproc

SRCS:= counting_mapping_probe.cpp
TARGET_LIB:= libcounting_mapping_probe.so

all: $(TARGET_LIB)

$(TARGET_LIB) : $(SRCS)
	$(CC) -o $@ $^ $(CFLAGS) $(LIBS)

clean:
	rm -rf $(TARGET_LIB)
