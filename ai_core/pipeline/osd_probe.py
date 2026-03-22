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

class OSDProbeHandler:
    """
    Handles extracting tracking information from the GStreamer OSD Pad Probe,
    processes it using Python services, and adds custom display metadata for drawing.
    """
    def __init__(self, frame_data_queue, counting_service: CountingService, mapping_service: MappingService):
        self.frame_data_queue = frame_data_queue
        self.counting_service = counting_service
        self.mapping_service = mapping_service
        self.info_threshold = 10
        self.warning_threshold = 25
        self.critical_threshold = 25
        self._probe_call_count = 0
        self._fps_frame_count = 0
        self._last_fps_time = time.time()

    def osd_sink_pad_buffer_probe(self, pad, info, u_data) -> Gst.PadProbeReturn:
        """
        Extracts NvDsObjectMeta, runs Python logic, and adds display metadata for drawing.
        """
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

            # Acquire a display meta object from the pool and reset counts
            display_meta = pyds.nvds_acquire_display_meta_from_pool(batch_meta)
            display_meta.num_labels = 0
            display_meta.num_lines = 0

            # === START PYTHON LOGIC & DRAWING ===

            # 1. Collect all objects from DeepStream
            bboxes_tlwh = []
            track_ids = []
            obj_metas = []
            l_obj = frame_meta.obj_meta_list
            while l_obj is not None:
                try:
                    obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
                    rect = obj_meta.rect_params
                    bboxes_tlwh.append([rect.left, rect.top, rect.width, rect.height])
                    track_ids.append(obj_meta.object_id)
                    obj_metas.append(obj_meta)
                    l_obj = l_obj.next
                except StopIteration:
                    break

            # 2. Call Python services for counting and mapping
            self.counting_service.update(bboxes_tlwh, track_ids)
            
            bboxes_xyxy = [[x, y, x + w, y + h] for x, y, w, h in bboxes_tlwh]
            current_frame_size = (frame_meta.source_frame_width, frame_meta.source_frame_height)
            current_map_size = self.mapping_service.map_size
            mapped_points = self.mapping_service.project_bboxes(
                bboxes=[tuple(b) for b in bboxes_xyxy],
                current_frame_size=current_frame_size,
                current_map_size=current_map_size,
            )

            # 3. Draw Track ID on each object (with safety check)
            for i, obj_meta in enumerate(obj_metas):
                # ROBUSTNESS CHECK: Ensure we do not exceed the allocated memory for text params.
                if i >= pyds.MAX_ELEMENTS_IN_DISPLAY_META:
                    logger.warning(f"Max number of labels ({pyds.MAX_ELEMENTS_IN_DISPLAY_META}) reached. Skipping drawing for some objects.")
                    break
                
                # Safely acquire the text parameters
                txt_params = display_meta.text_params[i]
                txt_params.display_text = f"ID: {obj_meta.object_id}"
                
                txt_params.x_offset = int(obj_meta.rect_params.left)
                txt_params.y_offset = int(obj_meta.rect_params.top) - 10
                
                txt_params.font_params.font_name = "Serif"
                txt_params.font_params.font_size = 10
                txt_params.font_params.font_color.set(1.0, 1.0, 1.0, 1.0)  # White
                txt_params.set_bg_clr = 1
                txt_params.text_bg_clr.set(0.0, 0.0, 0.0, 0.7) # Black, 70% opacity
                
                display_meta.num_labels += 1

            # 4. Draw the Counting Line (with safety check)
            # ROBUSTNESS CHECK: Ensure we have space to draw at least one line.
            if display_meta.num_lines < pyds.MAX_ELEMENTS_IN_DISPLAY_META:
                line_params = display_meta.line_params[display_meta.num_lines]
                line_params.x1 = int(self.counting_service.line_counter.start_point[0])
                line_params.y1 = int(self.counting_service.line_counter.start_point[1])
                line_params.x2 = int(self.counting_service.line_counter.end_point[0])
                line_params.y2 = int(self.counting_service.line_counter.end_point[1])
                line_params.line_width = 3
                line_params.line_color.set(0.0, 1.0, 0.0, 1.0) # Green
                display_meta.num_lines += 1

            # Add the display metadata to the frame for OSD to render
            pyds.nvds_add_display_meta_to_frame(frame_meta, display_meta)

            # --- Logic for data publishing (remains the same) ---
            objects = []
            for bbox_xyxy, coords, tid in zip(bboxes_xyxy, mapped_points, track_ids):
                objects.append(ObjectDetection(track_id=int(tid), bbox=bbox_xyxy, coordinates_2D=[float(coords[0]), float(coords[1])]))

            in_cnt = self.counting_service.count_in
            out_cnt = self.counting_service.count_out
            occupancy = self.counting_service.current_people
            
            alert = 'none'
            if occupancy > self.critical_threshold: alert = 'critical'
            elif self.critical_threshold >= occupancy > self.warning_threshold: alert = 'warning'
            elif self.warning_threshold >= occupancy > self.info_threshold: alert = 'info'
            
            frame_data = FrameData(
                timestamp=datetime.now(timezone.utc), count_in=in_cnt, count_out=out_cnt, occupancy=occupancy,
                alert=alert, save_to_db=True, height_frame=current_frame_size[1], width_frame=current_frame_size[0],
                height_2D=current_map_size[1], width_2D=current_map_size[0], objects=objects
            )
            
            if not self.frame_data_queue.full():
                self.frame_data_queue.put(frame_data)
                
            try:
                l_frame = l_frame.next
            except StopIteration:
                break
                
        return Gst.PadProbeReturn.OK
