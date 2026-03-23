import ctypes
from datetime import datetime, timezone
from loguru import logger
import time
import numpy as np

try:
    import pyds
except ImportError:
    pyds = None

import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst

from schemas.schemas import FrameData, ObjectDetection
from services.counting_service import CountingService
from services.mapping_service import MappingService
from config.data_config import OCSortConfig

MAX_DISPLAY_META_ELEMENTS = 64

class OSDProbeHandler:
    def __init__(self, frame_data_queue, counting_service: CountingService, mapping_service: MappingService, ocsort_config: OCSortConfig):
        self.frame_data_queue = frame_data_queue
        self.counting_service = counting_service
        self.mapping_service = mapping_service
        self.ocsort_config = ocsort_config
        self.info_threshold = 10
        self.warning_threshold = 25
        self.critical_threshold = 25
        self._fps_frame_count = 0
        self._last_fps_time = time.time()
        self.current_fps = 0.0

    def osd_sink_pad_buffer_probe(self, pad, info, u_data) -> Gst.PadProbeReturn:
        self._fps_frame_count += 1
        current_time = time.time()
        elapsed = current_time - self._last_fps_time
        if elapsed >= 5.0:
            self.current_fps = self._fps_frame_count / elapsed
            logger.info(f"[PERFORMANCE] 🚀 Probe FPS: {self.current_fps:.2f} FPS")
            self._last_fps_time = current_time
            self._fps_frame_count = 0

        if not pyds: return Gst.PadProbeReturn.OK
        gst_buffer = info.get_buffer()
        if not gst_buffer: return Gst.PadProbeReturn.OK

        batch_meta = pyds.gst_buffer_get_nvds_batch_meta(hash(gst_buffer))
        l_frame = batch_meta.frame_meta_list
        
        while l_frame is not None:
            try:
                frame_meta = pyds.NvDsFrameMeta.cast(l_frame.data)
            except StopIteration:
                break

            # 1. Collect and Filter all objects
            valid_bboxes_tlwh, valid_track_ids, valid_obj_metas = [], [], []
            l_obj = frame_meta.obj_meta_list
            while l_obj is not None:
                try:
                    obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
                    rect = obj_meta.rect_params
                    
                    # Use the coordinates directly from DeepStream
                    box_tlwh = [rect.left, rect.top, rect.width, rect.height]
                    
                    area = box_tlwh[2] * box_tlwh[3]
                    aspect_ratio = box_tlwh[2] / box_tlwh[3] if box_tlwh[3] > 0 else 0
                    
                    is_valid = (area >= self.ocsort_config.min_box_area and 
                                aspect_ratio <= self.ocsort_config.aspect_ratio_thresh)
                    
                    if is_valid:
                        valid_bboxes_tlwh.append(box_tlwh) # Use the direct, unscaled box
                        valid_track_ids.append(obj_meta.object_id)
                        valid_obj_metas.append(obj_meta)
                    
                    l_obj = l_obj.next
                except StopIteration:
                    break

            # 2. Call Python services with the correct data
            self.counting_service.update(valid_bboxes_tlwh, valid_track_ids)
            
            valid_bboxes_xyxy = [[x, y, x + w, y + h] for x, y, w, h in valid_bboxes_tlwh]
            current_frame_size = (frame_meta.source_frame_width, frame_meta.source_frame_height)
            current_map_size = self.mapping_service.map_size
            mapped_points = self.mapping_service.project_bboxes(
                bboxes=[tuple(b) for b in valid_bboxes_xyxy],
                current_frame_size=current_frame_size,
                current_map_size=current_map_size,
            )

            # 3. Draw Track ID on each VALID object
            for i, obj_meta in enumerate(valid_obj_metas):
                if i >= MAX_DISPLAY_META_ELEMENTS: break
                
                txt_params = obj_meta.text_params
                txt_params.display_text = f"ID: {obj_meta.object_id}"
                txt_params.x_offset = int(obj_meta.rect_params.left)
                txt_params.y_offset = int(obj_meta.rect_params.top) - 10
                
                txt_params.font_params.font_name = "Serif"
                txt_params.font_params.font_size = 10
                txt_params.font_params.font_color.set(1.0, 1.0, 1.0, 1.0)
                txt_params.set_bg_clr = 1
                txt_params.text_bg_clr.set(0.0, 0.0, 0.0, 0.7)

            # 4. Draw the Counting Line
            display_meta = pyds.nvds_acquire_display_meta_from_pool(batch_meta)
            display_meta.num_lines = 0
            if display_meta.num_lines < MAX_DISPLAY_META_ELEMENTS:
                display_meta.num_lines = 1
                line_params = display_meta.line_params[0]
                line_params.x1 = int(self.counting_service.line_counter.start_point[0])
                line_params.y1 = int(self.counting_service.line_counter.start_point[1])
                line_params.x2 = int(self.counting_service.line_counter.end_point[0])
                line_params.y2 = int(self.counting_service.line_counter.end_point[1])
                line_params.line_width = 3
                line_params.line_color.set(0.0, 1.0, 0.0, 1.0)
                pyds.nvds_add_display_meta_to_frame(frame_meta, display_meta)
            # === END OF FINAL FIX ===

            # --- Data publishing logic ---
            # ... (code giữ nguyên)
            
            try:
                l_frame = l_frame.next
            except StopIteration:
                break
                
        return Gst.PadProbeReturn.OK
