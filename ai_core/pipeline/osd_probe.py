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
        self.model_input_size = (640, 640)
        self.info_threshold = 10
        self.warning_threshold = 25
        self.critical_threshold = 25
        self._fps_frame_count = 0
        self._last_fps_time = time.time()
        self.current_fps = 0.0
        self.debug_mode = True # Enable debug logging

    def set_frame_sizes(self, processing_size: tuple, model_input_size: tuple):
        logger.info(f"OSD Probe Handler received sizes: processing={processing_size}, model_input={model_input_size}")
        self.processing_size = processing_size
        self.model_input_size = model_input_size

    def _scale_box_from_model_to_processing(self, box_tlwh: list, frame_num: int, obj_id: int) -> list:
        proc_w, proc_h = self.processing_size
        model_w, model_h = self.model_input_size
        
        ratio = min(model_w / proc_w, model_h / proc_h)
        
        x1, y1, w, h = box_tlwh
        
        scaled_x1 = x1 / ratio
        scaled_y1 = y1 / ratio
        scaled_w = w / ratio
        scaled_h = h / ratio
        
        if self.debug_mode:
            logger.debug(f"[F:{frame_num}|ID:{obj_id}] SCALING: Ratio={ratio:.4f} | RawBox(w,h)=({w:.1f}, {h:.1f}) -> ScaledBox(w,h)=({scaled_w:.1f}, {scaled_h:.1f})")

        return [scaled_x1, scaled_y1, scaled_w, scaled_h]

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

            # --- DEBUG: Log only for the first few frames to avoid spam ---
            if frame_meta.frame_num > 150 and self.debug_mode:
                logger.info("Disabling debug mode after 150 frames to reduce log spam.")
                self.debug_mode = False

            # 1. Collect, Scale, and Filter all objects
            bboxes_tlwh, track_ids, obj_metas = [], [], []
            l_obj = frame_meta.obj_meta_list
            while l_obj is not None:
                try:
                    obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
                    rect = obj_meta.rect_params
                    
                    if self.debug_mode:
                        logger.debug(f"[F:{frame_meta.frame_num}|ID:{obj_meta.object_id}] RAW BOX from DS: [l:{rect.left:.1f}, t:{rect.top:.1f}, w:{rect.width:.1f}, h:{rect.height:.1f}]")

                    scaled_box = self._scale_box_from_model_to_processing([rect.left, rect.top, rect.width, rect.height], frame_meta.frame_num, obj_meta.object_id)
                    scaled_w, scaled_h = scaled_box[2], scaled_box[3]
                    
                    area = scaled_w * scaled_h
                    aspect_ratio = scaled_w / scaled_h if scaled_h > 0 else 0
                    
                    is_valid = (area >= self.ocsort_config.min_box_area and 
                                aspect_ratio <= self.ocsort_config.aspect_ratio_thresh)
                    
                    if self.debug_mode:
                        logger.debug(f"[F:{frame_meta.frame_num}|ID:{obj_meta.object_id}] FILTER: Area={area:.1f} (>{self.ocsort_config.min_box_area:.1f}?) | Aspect={aspect_ratio:.2f} (<{self.ocsort_config.aspect_ratio_thresh:.2f}?) -> Valid: {is_valid}")

                    if is_valid:
                        bboxes_tlwh.append(scaled_box)
                        track_ids.append(obj_meta.object_id)
                        obj_metas.append(obj_meta)
                    
                    l_obj = l_obj.next
                except StopIteration:
                    break

            # 2. Call Python services with CORRECTLY SCALED data
            self.counting_service.update(bboxes_tlwh, track_ids)
            
            # --- Data publishing and drawing logic (no changes needed here) ---
            bboxes_xyxy = [[x, y, x + w, y + h] for x, y, w, h in bboxes_tlwh]
            current_frame_size = self.processing_size
            current_map_size = self.mapping_service.map_size
            mapped_points = self.mapping_service.project_bboxes(
                bboxes=[tuple(b) for b in bboxes_xyxy],
                current_frame_size=current_frame_size,
                current_map_size=current_map_size,
            )

            display_meta = pyds.nvds_acquire_display_meta_from_pool(batch_meta)
            display_meta.num_labels = 0
            display_meta.num_lines = 0
            for i, obj_meta in enumerate(obj_metas):
                if i >= MAX_DISPLAY_META_ELEMENTS: break
                scaled_box = bboxes_tlwh[i]
                txt_params = display_meta.text_params[i]
                txt_params.display_text = f"ID: {obj_meta.object_id}"
                txt_params.x_offset = int(scaled_box[0])
                txt_params.y_offset = int(scaled_box[1]) - 10
                txt_params.font_params.font_name = "Serif"
                txt_params.font_params.font_size = 10
                txt_params.font_params.font_color.set(1.0, 1.0, 1.0, 1.0)
                txt_params.set_bg_clr = 1
                txt_params.text_bg_clr.set(0.0, 0.0, 0.0, 0.7)
                display_meta.num_labels += 1

            if display_meta.num_lines < MAX_DISPLAY_META_ELEMENTS:
                line_params = display_meta.line_params[display_meta.num_lines]
                line_params.x1 = int(self.counting_service.line_counter.start_point[0])
                line_params.y1 = int(self.counting_service.line_counter.start_point[1])
                line_params.x2 = int(self.counting_service.line_counter.end_point[0])
                line_params.y2 = int(self.counting_service.line_counter.end_point[1])
                line_params.line_width = 3
                line_params.line_color.set(0.0, 1.0, 0.0, 1.0)
                display_meta.num_lines += 1
            pyds.nvds_add_display_meta_to_frame(frame_meta, display_meta)

            objects = []
            for bbox_xyxy, coords, tid in zip(bboxes_xyxy, mapped_points, track_ids):
                objects.append(ObjectDetection(track_id=int(tid), bbox=bbox_xyxy, coordinates_2D=[float(coords[0]), float(coords[1])]))

            in_cnt = self.counting_service.count_in
            out_cnt = self.counting_service.count_out
            occupancy = self.counting_service.current_people

            if out_cnt > in_cnt:
                logger.warning(f"Reversed count detected (In: {in_cnt}, Out: {out_cnt}). Check 'inside_point' in counting_config.json.")

            alert = 'none'
            if occupancy >= self.critical_threshold: alert = 'critical'
            elif occupancy >= self.warning_threshold: alert = 'warning'
            elif occupancy >= self.info_threshold: alert = 'info'
            
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
