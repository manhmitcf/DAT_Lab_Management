import ctypes
from datetime import datetime, timezone
from loguru import logger
import time
try:
    import pyds
except ImportError:
    pyds = None

import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst

from schemas.schemas import FrameData, ObjectDetection
from services.cpp_probe_service import cpp_probe_service, CustomMappingData

class OSDProbeHandler:
    """
    Handles extracting C++ NvDsUserMeta mapping data and tracking information
    from the GStreamer OSD Pad Probe.
    """
    def __init__(self, frame_data_queue, mapping_config, counting_config):
        self.frame_data_queue = frame_data_queue
        self.mapping_config = mapping_config
        self.info_threshold = counting_config.info_threshold
        self.warning_threshold = counting_config.warning_threshold
        self.critical_threshold = counting_config.critical_threshold
        self._probe_call_count = 0  # [DEBUG] probe fire counter
        self._fps_frame_count = 0
        self._last_fps_time = time.time()

    def osd_sink_pad_buffer_probe(self, pad, info, u_data) -> Gst.PadProbeReturn:
        """Extracts C++ generated tracking metadata to feed the ResultPublisher."""
        self._probe_call_count += 1
        self._fps_frame_count += 1
        current_time = time.time()
        elapsed = current_time - self._last_fps_time
        if elapsed >= 10.0:  # Log FPS every 10 seconds
            fps = self._fps_frame_count / elapsed
            logger.info(f"[PERFORMANCE] 🚀 Processing Speed: {fps:.2f} FPS")
            self._last_fps_time = current_time
            self._fps_frame_count = 0

        if self._probe_call_count == 1:
            logger.info(f"[OSDProbe] Probe FIRED for first time. pyds available: {pyds is not None}")

        if not pyds:
            return Gst.PadProbeReturn.OK

        gst_buffer = info.get_buffer()
        if not gst_buffer:
            logger.error("Unable to get GstBuffer")
            return Gst.PadProbeReturn.OK

        batch_meta = pyds.gst_buffer_get_nvds_batch_meta(hash(gst_buffer))
        l_frame = batch_meta.frame_meta_list
        
        while l_frame is not None:
            try:
                frame_meta = pyds.NvDsFrameMeta.cast(l_frame.data)
            except StopIteration:
                break
            
            objects = []
            l_obj = frame_meta.obj_meta_list
            while l_obj is not None:
                try:
                    obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
                except StopIteration:
                    break
                
                if obj_meta.object_id > 0:
                    # Direct query from C++ cache (No Metadata iteration = NO DOUBLE FREE)
                    mapped_coords = cpp_probe_service.get_object_mapping(obj_meta.object_id)

                if obj_meta.object_id > 0:
                    rect = obj_meta.rect_params
                    bbox = [rect.left, rect.top, rect.left + rect.width, rect.top + rect.height]
                    
                    obj_det = ObjectDetection(
                        track_id=obj_meta.object_id,
                        bbox=bbox,
                        coordinates_2D=mapped_coords
                    )
                    objects.append(obj_det)
                    
                try:
                    l_obj = l_obj.next
                except StopIteration:
                    break
            
            in_cnt, out_cnt = cpp_probe_service.get_counts()
            
            map_w = self.mapping_config.map_size[0] if self.mapping_config.map_size else 723
            map_h = self.mapping_config.map_size[1] if self.mapping_config.map_size else 1266
            
            occupancy = max(0, in_cnt - out_cnt)
            alert = 'none'
            
            crit = self.critical_threshold if self.critical_threshold is not None else 25
            warn = self.warning_threshold if self.warning_threshold is not None else 25
            inf = self.info_threshold if self.info_threshold is not None else 10
            
            if occupancy > crit:
                alert = 'critical'
            elif occupancy <= warn and occupancy > inf:
                alert = 'warning'
            elif occupancy <= inf:
                alert = 'info'
            
            frame_data = FrameData(
                timestamp=datetime.now(timezone.utc),
                count_in=in_cnt,
                count_out=out_cnt,
                occupancy=occupancy,
                alert=alert,
                save_to_db=True,
                height_frame=frame_meta.source_frame_height,
                width_frame=frame_meta.source_frame_width,
                height_2D=map_h,
                width_2D=map_w,
                objects=objects
            )
            
            if not self.frame_data_queue.full():
                self.frame_data_queue.put(frame_data)
                
            try:
                l_frame = l_frame.next
            except StopIteration:
                break
                
        return Gst.PadProbeReturn.OK
