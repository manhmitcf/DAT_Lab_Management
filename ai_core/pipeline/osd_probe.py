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
    and then processes it using Python-based Counting and Mapping services.
    """
    def __init__(self, frame_data_queue, counting_service: CountingService, mapping_service: MappingService):
        self.frame_data_queue = frame_data_queue
        
        # Keep instances of the Python services
        self.counting_service = counting_service
        self.mapping_service = mapping_service

        # Alert thresholds will be managed by the main_app
        self.info_threshold = 10
        self.warning_threshold = 25
        self.critical_threshold = 25
        
        self._probe_call_count = 0
        self._fps_frame_count = 0
        self._last_fps_time = time.time()

    def osd_sink_pad_buffer_probe(self, pad, info, u_data) -> Gst.PadProbeReturn:
        """
        Extracts NvDsObjectMeta, then runs Python counting and mapping logic.
        """
        self._probe_call_count += 1
        self._fps_frame_count += 1
        current_time = time.time()
        elapsed = current_time - self._last_fps_time
        if elapsed >= 10.0:
            fps = self._fps_frame_count / elapsed
            logger.info(f"[PERFORMANCE] 🚀 Processing Speed: {fps:.2f} FPS")
            self._last_fps_time = current_time
            self._fps_frame_count = 0

        if self._probe_call_count == 1:
            logger.info(f"[OSDProbe] Python Probe FIRED for first time. pyds available: {pyds is not None}")

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
            
            # === START NEW PYTHON LOGIC ===

            # 1. Collect all objects from DeepStream
            bboxes_tlwh = []
            track_ids = []
            l_obj = frame_meta.obj_meta_list
            while l_obj is not None:
                try:
                    obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
                    rect = obj_meta.rect_params
                    
                    # Convert bbox to tlwh format (top-left-x, top-left-y, width, height)
                    bboxes_tlwh.append([rect.left, rect.top, rect.width, rect.height])
                    track_ids.append(obj_meta.object_id)
                    
                    l_obj = l_obj.next
                except StopIteration:
                    break

            # 2. Call CountingService with the collected data
            # The counting logic (using bottom-center, state machine, margin) will be executed here
            self.counting_service.update(bboxes_tlwh, track_ids)
            
            # 3. Call MappingService
            # Convert bboxes to xyxy format for the mapping service
            bboxes_xyxy = [[x, y, x + w, y + h] for x, y, w, h in bboxes_tlwh]
            
            current_frame_size = (frame_meta.source_frame_width, frame_meta.source_frame_height)
            current_map_size = self.mapping_service.map_size

            # The projection logic (using bottom-center, coordinate scaling) will be executed here
            mapped_points = self.mapping_service.project_bboxes(
                bboxes=[tuple(b) for b in bboxes_xyxy],
                current_frame_size=current_frame_size,
                current_map_size=current_map_size,
            )

            # 4. Create the list of objects with data processed by Python
            objects = []
            for bbox_xyxy, coords, tid in zip(bboxes_xyxy, mapped_points, track_ids):
                objects.append(
                    ObjectDetection(
                        track_id=int(tid),
                        bbox=bbox_xyxy,
                        coordinates_2D=[float(coords[0]), float(coords[1])],
                    )
                )

            # 5. Get counting results from the Python service
            in_cnt = self.counting_service.count_in
            out_cnt = self.counting_service.count_out
            occupancy = self.counting_service.current_people

            # === END NEW PYTHON LOGIC ===

            # Alert logic remains the same
            alert = 'none'
            if occupancy > self.critical_threshold:
                alert = 'critical'
            elif self.critical_threshold >= occupancy > self.warning_threshold:
                alert = 'warning'
            elif self.warning_threshold >= occupancy > self.info_threshold:
                alert = 'info'
            
            frame_data = FrameData(
                timestamp=datetime.now(timezone.utc),
                count_in=in_cnt,
                count_out=out_cnt,
                occupancy=occupancy,
                alert=alert,
                save_to_db=True,
                height_frame=current_frame_size[1],
                width_frame=current_frame_size[0],
                height_2D=current_map_size[1],
                width_2D=current_map_size[0],
                objects=objects
            )
            
            if not self.frame_data_queue.full():
                self.frame_data_queue.put(frame_data)
                
            try:
                l_frame = l_frame.next
            except StopIteration:
                break
                
        return Gst.PadProbeReturn.OK
