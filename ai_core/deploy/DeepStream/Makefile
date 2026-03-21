CUDA_VER?=12.2
ifeq ($(CUDA_VER),)
  $(error "CUDA_VER is not set")
endif

# Path to DeepStream library (change depending on version, e.g. 6.2, 7.0)
DEEPSTREAM_DIR:=/opt/nvidia/deepstream/deepstream

CC:= g++
CFLAGS:= -Wall -std=c++11 -shared -fPIC -Wno-error=deprecated-declarations
CFLAGS+= -I$(DEEPSTREAM_DIR)/sources/includes \
         -I/usr/local/cuda-$(CUDA_VER)/include

LIBS:= -lnvinfer_custom_impl_setup -nvinfer

SRCS:= nvdsparsebbox_YoloX.cpp
TARGET_LIB:= libnvdsinfer_custom_impl_YoloX.so

all: $(TARGET_LIB)

$(TARGET_LIB) : $(SRCS)
	$(CC) -o $@ $^ $(CFLAGS) -I$(DEEPSTREAM_DIR)/sources/includes -L$(DEEPSTREAM_DIR)/lib -lnvds_meta -lnvds_infer

clean:
	rm -rf $(TARGET_LIB)
