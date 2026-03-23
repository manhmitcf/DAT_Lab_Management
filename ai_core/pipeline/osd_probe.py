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
        self.processing_size = (1920, 1080)
        self.info_threshold = 10
        self.warning_threshold = 25
        self.critical_threshold = 25
        self._fps_frame_count = 0
        self._last_fps_time = time.time()
        self.current_fps = 0.0

    def set_processing_size(self, size: tuple):
        logger.info(f"OSD Probe Handler received correct processing size: {size}")
        self.processing_size = size

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

            valid_bboxes_tlwh, valid_track_ids, valid_obj_metas = [], [], []
            l_obj = frame_meta.obj_meta_list
            while l_obj is not None:
                try:
                    obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
                    rect = obj_meta.rect_params
                    box_tlwh = [rect.left, rect.top, rect.width, rect.height]
                    area = box_tlwh[2] * box_tlwh[3]
                    aspect_ratio = box_tlwh[2] / box_tlwh[3] if box_tlwh[3] > 0 else 0
                    
                    is_valid = (area >= self.ocsort_config.min_box_area and 
                                aspect_ratio <= self.ocsort_config.aspect_ratio_thresh)
                    
                    if is_valid:
                        valid_bboxes_tlwh.append(box_tlwh)
                        valid_track_ids.append(obj_meta.object_id)
                        valid_obj_metas.append(obj_meta)
                    else:
                        # Ẩn hoàn toàn các box không hợp lệ, không cho nvosd vẽ
                        obj_meta.rect_params.border_width = 0
                        obj_meta.text_params.display_text = ""
                        obj_meta.text_params.set_bg_clr = 0
                    
                    l_obj = l_obj.next
                except StopIteration:
                    break

            self.counting_service.update(valid_bboxes_tlwh, valid_track_ids)
            
            valid_bboxes_xyxy = [[x, y, x + w, y + h] for x, y, w, h in valid_bboxes_tlwh]
            current_frame_size = self.processing_size
            current_map_size = self.mapping_service.map_size
            mapped_points = self.mapping_service.project_bboxes(
                bboxes=[tuple(b) for b in valid_bboxes_xyxy],
                current_frame_size=current_frame_size,
                current_map_size=current_map_size,
            )

            for obj_meta in valid_obj_metas:
                # Đảm bảo box hợp lệ được hiển thị với màu sắc và nội dung tùy chỉnh
                obj_meta.rect_params.border_width = 2
                obj_meta.rect_params.border_color.set(0.0, 1.0, 0.0, 1.0) # Màu Xanh lá
                
                txt_params = obj_meta.text_params
                # Deepstream python bindings update text
                new_text = f"ID: {obj_meta.object_id}"
                
                # Ở một số bản pyds, gán chữ trực tiếp bị ghi đè, ta thử cấp phát chuỗi
                import pyds
                if hasattr(pyds, 'get_string'):
                    txt_params.display_text = pyds.get_string(new_text)
                else:
                    txt_params.display_text = new_text

                txt_params.x_offset = int(obj_meta.rect_params.left)
                txt_params.y_offset = max(0, int(obj_meta.rect_params.top) - 20)
                txt_params.font_params.font_name = "Serif"
                txt_params.font_params.font_size = 12
                txt_params.font_params.font_color.set(1.0, 1.0, 1.0, 1.0)
                txt_params.set_bg_clr = 1
                txt_params.text_bg_clr.set(0.0, 0.0, 0.0, 0.7)

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

            objects = []
            for bbox_xyxy, coords, tid in zip(valid_bboxes_xyxy, mapped_points, valid_track_ids):
                objects.append(ObjectDetection(track_id=int(tid), bbox=bbox_xyxy, coordinates_2D=[float(coords[0]), float(coords[1])]))

            in_cnt = self.counting_service.count_in
            out_cnt = self.counting_service.count_out
            occupancy = self.counting_service.current_people

            if out_cnt > in_cnt:
                logger.warning(f"Reversed count detected (In: {in_cnt}, Out: {out_cnt}). Check 'inside_point' in counting_config.json.")

            alert = 'none'
            if occupancy > self.critical_threshold:
                alert = 'critical'
            elif occupancy > self.info_threshold:
                alert = 'warning'
            elif occupancy > 0:
                alert = 'info'
            
            frame_data = FrameData(
                timestamp=datetime.now(timezone.utc), count_in=in_cnt, count_out=out_cnt, occupancy=occupancy,
                alert=alert, fps=self.current_fps, save_to_db=True, 
                height_frame=current_frame_size[1], width_frame=current_frame_size[0],
                height_2D=current_map_size[1], width_2D=current_map_size[0], objects=objects
            )
            
            if not self.frame_data_queue.full():
                self.frame_data_queue.put(frame_data)
            
            try:
                l_frame = l_frame.next
            except StopIteration:
                break
                
        return Gst.PadProbeReturn.OK
