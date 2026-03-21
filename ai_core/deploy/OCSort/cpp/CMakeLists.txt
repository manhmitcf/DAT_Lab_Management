cmake_minimum_required(VERSION 3.10)
project(OCSort_NvMOT)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -fPIC")

# Find required libraries (Eigen3 and OpenCV)
find_package(Eigen3 REQUIRED)
find_package(OpenCV REQUIRED)

# Path to DeepStream NvTracker headers
set(DEEPSTREAM_DIR "/opt/nvidia/deepstream/deepstream")
include_directories(
    ${EIGEN3_INCLUDE_DIR}
    ${OpenCV_INCLUDE_DIRS}
    ${DEEPSTREAM_DIR}/sources/includes
    include
)

# Collect all original OCSort cpp files and the NvMOT_Wrapper file
file(GLOB SOURCES "src/*.cpp")

# Build as a shared library (.so) instead of an executable (.out)
add_library(nvds_ocsort SHARED ${SOURCES})

# Link against OpenCV
target_link_libraries(nvds_ocsort ${OpenCV_LIBS})

# Install target
install(TARGETS nvds_ocsort DESTINATION lib)
