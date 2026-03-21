import ctypes
import os
import numpy as np
from loguru import logger
from typing import List, Tuple

class CustomMappingData(ctypes.Structure):
    _fields_ = [
        ("map_x", ctypes.c_float),
        ("map_y", ctypes.c_float)
    ]

class CPPProbeService:
    def __init__(self, lib_path: str = "./deploy/DeepStream/cpp_logic/libcounting_mapping_probe.so"):
        self.lib = None
        if os.path.exists(lib_path):
            try:
                self.lib = ctypes.CDLL(lib_path)
                # Mapping Results Query
                self.lib.get_object_mapping_coords.argtypes = [ctypes.c_int, ctypes.POINTER(ctypes.c_float), ctypes.POINTER(ctypes.c_float)]
                self.lib.get_object_mapping_coords.restype = ctypes.c_bool
                
                logger.success(f"Successfully loaded C++ probe library from {lib_path}")
                
                # Setup argument types
                self.lib.update_counting_config.argtypes = [
                    ctypes.c_float, ctypes.c_float, # start_x, start_y
                    ctypes.c_float, ctypes.c_float, # end_x, end_y
                    ctypes.c_float, ctypes.c_float, # inside_x, inside_y
                    ctypes.c_float                  # margin
                ]
                
                self.lib.update_mapping_config.argtypes = [
                    ctypes.POINTER(ctypes.c_float), # cam_pts (flat array)
                    ctypes.POINTER(ctypes.c_float), # map_pts (flat array)
                    ctypes.c_int,                   # num_pts
                    ctypes.c_int,                   # map_w
                    ctypes.c_int                    # map_h
                ]
                
                self.lib.get_current_counts.argtypes = [
                    ctypes.POINTER(ctypes.c_int), # in_cnt
                    ctypes.POINTER(ctypes.c_int)  # out_cnt
                ]
                
                # Attach probe to pad
                self.lib.attach_cpp_probe_to_pad.argtypes = [ctypes.c_void_p]
            except Exception as e:
                logger.error(f"Failed to load C++ probe library: {e}")
        else:
            logger.warning(f"C++ probe library not found at {lib_path}. Fallback to Python logic only.")

    @property
    def is_available(self) -> bool:
        return self.lib is not None

    def update_counting(self, start: Tuple[float, float], end: Tuple[float, float], inside: Tuple[float, float], margin: float):
        if self.lib is None:
            return
        
        try:
            self.lib.update_counting_config(
                float(start[0]), float(start[1]),
                float(end[0]), float(end[1]),
                float(inside[0]), float(inside[1]),
                float(margin)
            )
            logger.info("C++ Counting config updated via ctypes.")
        except Exception as e:
            logger.error(f"Error calling C++ update_counting_config: {e}")

    def update_mapping(self, camera_points: List[Tuple[float, float]], map_points: List[Tuple[float, float]], map_size: Tuple[int, int]):
        if self.lib is None:
            return
        
        num_pts = min(len(camera_points), len(map_points))
        if num_pts < 4:
            return

        try:
            # Flatten lists to 1D arrays
            cam_flat = [float(coord) for i in range(num_pts) for coord in camera_points[i]]
            map_flat = [float(coord) for i in range(num_pts) for coord in map_points[i]]
            
            cam_arr_type = ctypes.c_float * len(cam_flat)
            map_arr_type = ctypes.c_float * len(map_flat)
            cam_arr = cam_arr_type(*cam_flat)
            map_arr = map_arr_type(*map_flat)
            
            self.lib.update_mapping_config(
                cam_arr, map_arr,
                ctypes.c_int(num_pts),
                ctypes.c_int(map_size[0]), ctypes.c_int(map_size[1])
            )
            logger.info("C++ Mapping config updated via ctypes.")
        except Exception as e:
            logger.error(f"Error calling C++ update_mapping_config: {e}")

    def get_counts(self) -> Tuple[int, int]:
        if self.lib is None:
            return 0, 0
            
        in_cnt = ctypes.c_int(0)
        out_cnt = ctypes.c_int(0)
        try:
            self.lib.get_current_counts(ctypes.byref(in_cnt), ctypes.byref(out_cnt))
            return in_cnt.value, out_cnt.value
        except Exception as e:
            logger.error(f"Error calling C++ get_current_counts: {e}")
            return 0, 0

    def attach_probe(self, pad_ptr: int):
        if self.lib is None:
            return
        try:
            self.lib.attach_cpp_probe_to_pad(ctypes.c_void_p(pad_ptr))
            logger.info("Successfully attached C++ probe to GstPad.")
        except Exception as e:
            logger.error(f"Error attaching C++ probe: {e}")

    def get_object_mapping(self, object_id: int):
        """
        Directly query cached mapping coordinates for an object.
        Returns [x, y] or None if not found/mapping not ready.
        """
        if self.lib is None:
            return None
        
        x = ctypes.c_float(0.0)
        y = ctypes.c_float(0.0)
        
        try:
            found = self.lib.get_object_mapping_coords(
                ctypes.c_int(object_id),
                ctypes.byref(x),
                ctypes.byref(y)
            )
            
            if found:
                return [float(x.value), float(y.value)]
        except Exception as e:
            logger.error(f"Error calling C++ get_object_mapping_coords: {e}")
            
        return None

cpp_probe_service = CPPProbeService()
