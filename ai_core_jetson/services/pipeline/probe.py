"""
Analytics Probe for DeepStream.
Orchestrates Tracking, Counting, Mapping, and Result Publishing.
Handles metadata extraction and visual injection for OSD.
"""

import time
from datetime import datetime, timezone
import numpy as np
import pyds
from loguru import logger

from services.analytics.tracking_service import TrackingService
from services.analytics.counting_service import CountingService
from services.analytics.mapping_service import MappingService
from services.gateway.backend_gateway import ResultPublisher
from schemas.schemas import FrameData, ObjectDetection


class AnalyticsProbe:
    """
    Pad probe handler that runs analytics on DeepStream metadata.
    """

    def __init__(
        self,
        tracking_service: TrackingService,
        counting_service: CountingService,
        mapping_service: MappingService,
        publisher: ResultPublisher,
        warning_threshold: int = 25,
        critical_threshold: int = 50,
    ):
        self.tracking_service = tracking_service
        self.counting_service = counting_service
        self.mapping_service = mapping_service
        self.publisher = publisher
        
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold

        # Visual styles (matching legacy)
        self.line_color = (255, 0, 255, 1.0)  # Magenta (RGBA for pyds)
        self.text_color = (1.0, 1.0, 1.0, 1.0)  # White
        
        # High-contrast colors for tracks (Zeno's Dichotomy replication simplified)
        self.color_palette = self._generate_palette(100)

    def _generate_palette(self, n: int):
        """Replicate legacy color palette logic."""
        palette = []
        for i in range(n):
            # Simple high-contrast generation for now
            r = (i * 37) % 255
            g = (i * 71) % 255
            b = (i * 113) % 255
            palette.append((r / 255.0, g / 255.0, b / 255.0, 1.0))
        return palette

    def probe_callback(self, pad, info, u_data):
        """
        GStreamer Pad Probe Callback.
        """
        gst_buffer = info.get_buffer()
        if not gst_buffer:
            logger.error("Unable to get GstBuffer from probe info")
            return pyds.GST_PAD_PROBE_OK

        # 1. Access Batch Metadata
        batch_meta = pyds.gst_buffer_get_nvds_batch_meta(hash(gst_buffer))
        l_frame = batch_meta.frame_meta_list
        
        while l_frame is not None:
            try:
                frame_meta = pyds.NvDsFrameMeta.cast(l_frame.data)
            except StopIteration:
                break

            self._process_frame_meta(frame_meta, batch_meta)

            try:
                l_frame = l_frame.next
            except StopIteration:
                break

        return pyds.GST_PAD_PROBE_OK

    def _process_frame_meta(self, frame_meta, batch_meta):
        """Extract objects, run services, and update metadata."""
        frame_id = frame_meta.frame_num
        timestamp = datetime.now(timezone.utc)
        
        # 1. Extract raw detections from nvinfer metadata
        detections = []
        l_obj = frame_meta.object_meta_list
        while l_obj is not None:
            try:
                obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
                rect = obj_meta.rect_params
                # Format: [x1, y1, x2, y2, score, class_id]
                detections.append([
                    rect.left, 
                    rect.top, 
                    rect.left + rect.width, 
                    rect.top + rect.height, 
                    obj_meta.confidence, 
                    obj_meta.class_id
                ])
                l_obj = l_obj.next
            except StopIteration:
                break

        if not detections:
            # Still need to update counters if no one is in frame
            self.counting_service.update([], [])
            self._send_empty_frame(frame_meta, timestamp)
            self._draw_osd(frame_meta, batch_meta)
            return

        # 2. Run Tracking (C++ OCSort)
        detections_np = np.array(detections, dtype=np.float32)
        tracked_objects = self.tracking_service.update(detections_np)
        
        # tracked_objects format: [x1, y1, x2, y2, track_id, class_id]
        bboxes_xyxy = tracked_objects[:, :4].tolist()
        track_ids = tracked_objects[:, 4].astype(int).tolist()

        # 3. Sync Track IDs back to NvDsObjectMeta for nvdsosd
        self._sync_track_ids(frame_meta, tracked_objects)

        # 4. Run Counting Service
        self.counting_service.update(bboxes_xyxy, track_ids)

        # 5. Run Mapping Service
        video_size = (frame_meta.source_frame_width, frame_meta.source_frame_height)
        # Assuming map_size is handled by MappingService.update_mapping or config
        # We project to the internal map_size defined in MappingService
        map_coords = self.mapping_service.project_bboxes(
            bboxes=bboxes_xyxy, 
            current_frame_size=video_size
        )

        # 6. Construct Objects List for Backend
        objects = []
        for bbox, tid, coords in zip(bboxes_xyxy, track_ids, map_coords):
            objects.append(
                ObjectDetection(
                    track_id=tid,
                    bbox=bbox,
                    coordinates_2D=[float(coords[0]), float(coords[1])]
                )
            )

        # 7. Calculate Alert Status
        current_people = self.counting_service.current_people
        alert = "info"
        if current_people >= self.critical_threshold:
            alert = "critical"
        elif current_people >= self.warning_threshold:
            alert = "warning"

        # 8. Create FrameData
        frame_data = FrameData(
            timestamp=timestamp,
            count_in=self.counting_service.count_in,
            count_out=self.counting_service.count_out,
            occupancy=current_people,
            height_frame=video_size[1],
            width_frame=video_size[0],
            height_2D=self.mapping_service.map_size[1] if self.mapping_service.map_size else 0,
            width_2D=self.mapping_service.map_size[0] if self.mapping_service.map_size else 0,
            objects=objects,
            alert=alert
        )

        # 9. Publish results
        self.publisher.send_frame(frame_data)

        # 10. Draw OSD metadata (Counting Line, Counts)
        self._draw_osd(frame_meta, batch_meta)

    def _sync_track_ids(self, frame_meta, tracked_objects):
        """Update NvDsObjectMeta with OCSort Track IDs and colors."""
        l_obj = frame_meta.object_meta_list
        while l_obj is not None:
            try:
                obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
                rect = obj_meta.rect_params
                
                # Match by position (heuristics for DeepStream metadata sync)
                for obj in tracked_objects:
                    # Allowing small epsilon for floating point matches
                    if abs(rect.left - obj[0]) < 1.0 and abs(rect.top - obj[1]) < 1.0:
                        tid = int(obj[4])
                        obj_meta.object_id = tid
                        
                        # Apply legacy-style color
                        color = self.color_palette[tid % len(self.color_palette)]
                        rect.border_color.set(*color)
                        rect.border_width = 2
                        
                        # Set ID text
                        obj_meta.text_params.display_text = f"ID:{tid}"
                        obj_meta.text_params.font_params.font_size = 12
                        break
                
                l_obj = l_obj.next
            except StopIteration:
                break

    def _draw_osd(self, frame_meta, batch_meta):
        """Inject custom lines and text for nvdsosd."""
        display_meta = pyds.nvds_acquire_display_meta_from_pool(batch_meta)
        
        # 1. Draw Counting Line
        line = self.counting_service.line_counter
        if line:
            l_params = display_meta.line_params[0]
            l_params.x1 = int(line.start_point[0])
            l_params.y1 = int(line.start_point[1])
            l_params.x2 = int(line.end_point[0])
            l_params.y2 = int(line.end_point[1])
            l_params.line_width = 3
            l_params.line_color.set(*self.line_color)
            display_meta.num_lines = 1

        # 2. Draw Counts Text
        txt_params = display_meta.text_params[0]
        in_c = self.counting_service.count_in
        out_c = self.counting_service.count_out
        occ = self.counting_service.current_people
        txt_params.display_text = f"In: {in_c} | Out: {out_c} | Occ: {occ}"
        txt_params.x_offset = 20
        txt_params.y_offset = 40
        txt_params.font_params.font_name = "Serif"
        txt_params.font_params.font_size = 15
        txt_params.font_params.font_color.set(1.0, 1.0, 1.0, 1.0)
        txt_params.set_bg_clr = 1
        txt_params.text_bg_clr.set(0.0, 0.0, 0.0, 0.5)
        display_meta.num_labels = 1
        
        pyds.nvds_add_display_meta_to_frame(frame_meta, display_meta)

    def _send_empty_frame(self, frame_meta, timestamp):
        """Send empty metadata if no detections present."""
        frame_data = FrameData(
            timestamp=timestamp,
            count_in=self.counting_service.count_in,
            count_out=self.counting_service.count_out,
            occupancy=self.counting_service.current_people,
            height_frame=frame_meta.source_frame_height,
            width_frame=frame_meta.source_frame_width,
            objects=[],
            alert="none"
        )
        self.publisher.send_frame(frame_data)
