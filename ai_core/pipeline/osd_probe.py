import ctypes
from datetime import datetime, timezone
from loguru import logger

try:
    import pyds
except ImportError:
    pyds = None

import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst

from schemas.schemas import FrameData, ObjectDetection
from services.cpp_probe_service import cpp_probe_service, CustomMappingData
from services.mapping_service import MappingService

class OSDProbeHandler:
    """
    Handles extracting C++ NvDsUserMeta mapping data and tracking information
    from the GStreamer OSD Pad Probe.
    """
    def __init__(self, frame_data_queue, mapping_service: MappingService, counting_config):
        self.frame_data_queue = frame_data_queue
        self.mapping_service = mapping_service
        self.info_threshold = counting_config.info_threshold
        self.warning_threshold = counting_config.warning_threshold
        self.critical_threshold = counting_config.critical_threshold

    def osd_sink_pad_buffer_probe(self, pad, info, u_data) -> Gst.PadProbeReturn:
        """Extracts C++ generated tracking metadata to feed the ResultPublisher."""
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
                
                mapped_coords = None
                if obj_meta.object_id > 0:
                    l_user_meta = obj_meta.obj_user_meta_list
                    while l_user_meta is not None:
                        try:
                            user_meta = pyds.NvDsUserMeta.cast(l_user_meta.data)
                        except StopIteration:
                            break
                        
                        target_type = pyds.nvds_get_user_meta_type("NVDS.CUSTOM.MAPPING.META")
                        if user_meta.base_meta.meta_type == target_type:
                            c_ptr = ctypes.cast(pyds.get_ptr(user_meta.user_meta_data), ctypes.POINTER(CustomMappingData))
                            c_data = c_ptr.contents
                            mapped_coords = [float(c_data.map_x), float(c_data.map_y)]
                            
                        try:
                            l_user_meta = l_user_meta.next
                        except StopIteration:
                            break

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
            
            map_w = self.mapping_service.map_size[0] if self.mapping_service.map_size else 723
            map_h = self.mapping_service.map_size[1] if self.mapping_service.map_size else 1266
            
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
