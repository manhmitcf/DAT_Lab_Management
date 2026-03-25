"""
Analytics Probe for DeepStream.
Orchestrates Tracking, Counting, Mapping, and Result Publishing.
Handles metadata extraction and visual injection for OSD.

Architecture (Multi-Threaded):
  GStreamer Thread (fast):  Extract Meta → OCSort(C++) → Counting → Draw OSD → return frame
  Analytics Thread (bg):   Mapping(Homography) → Serialize FrameData → Publish WebSocket
"""

import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst

import time
import queue
import threading
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
        self.color_palette = self._generate_palette(256)

        # Performance Monitoring
        self.frame_count = 0
        self.fps_start_time = time.time()
        self.current_fps = 0.0

        # --- Background Analytics Thread ---
        self._analytics_queue: queue.Queue = queue.Queue(maxsize=5)
        self._stop_event = threading.Event()
        self._analytics_thread = threading.Thread(
            target=self._analytics_worker, name="analytics-worker", daemon=True
        )
        self._analytics_thread.start()

    @staticmethod
    def _generate_palette(n: int):
        """Generate colors with maximum contrast between consecutive IDs using golden angle."""
        import colorsys
        golden_angle = 0.618033988749895  # 1 / golden_ratio
        palette = []
        for i in range(n):
            hue = (i * golden_angle) % 1.0  # golden angle spacing
            saturation = 0.9 if (i % 2 == 0) else 0.7  # alternate saturation
            value = 1.0 if (i % 3 != 0) else 0.85       # alternate brightness
            r, g, b = colorsys.hsv_to_rgb(hue, saturation, value)
            palette.append((r, g, b, 1.0))
        return palette

    def probe_callback(self, pad, info, u_data):
        """
        GStreamer Pad Probe Callback.
        """
        gst_buffer = info.get_buffer()
        if not gst_buffer:
            logger.error("Unable to get GstBuffer from probe info")
            return Gst.PadProbeReturn.OK

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

        return Gst.PadProbeReturn.OK

    def _process_frame_meta(self, frame_meta, batch_meta):
        """
        FAST PATH (GStreamer thread): Extract → OCSort → Counting → OSD.
        Mapping + Publishing are offloaded to background thread.
        """
        frame_id = frame_meta.frame_num
        timestamp = datetime.now(timezone.utc)
        
        # 1. Extract raw detections from nvinfer metadata
        detections = []
        l_obj = frame_meta.obj_meta_list
        while l_obj is not None:
            try:
                obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
                rect = obj_meta.rect_params
                
                # ALWAYS set border so bbox is visible on nvdsosd/Janus
                rect.border_width = 3
                rect.border_color.set(0.0, 1.0, 0.0, 1.0)  # Green
                
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
            self._enqueue_analytics_job(timestamp, frame_meta, [], [])
            self._draw_osd(frame_meta, batch_meta)
            return

        # DEBUG: Log detection details for first 10 frames to diagnose OCSort
        if frame_id <= 10:
            for idx, d in enumerate(detections):
                logger.debug(f"  [Frame {frame_id}] Det#{idx}: bbox=({d[0]:.0f},{d[1]:.0f},{d[2]:.0f},{d[3]:.0f}) score={d[4]:.4f} class={d[5]}")

        # 2. Run Tracking (C++ OCSort) — extremely fast
        detections_np = np.array(detections, dtype=np.float32)
        img_size = (frame_meta.source_frame_width, frame_meta.source_frame_height)
        tracked_objects = self.tracking_service.update(detections_np, img_size, img_size)
        
        # DEBUG: Log OCSort output
        if frame_id <= 10:
            logger.debug(f"  [Frame {frame_id}] OCSort returned {len(tracked_objects)} tracks")
        
        # 3. Use tracked results if available, otherwise fall back to raw detections
        if len(tracked_objects) > 0:
            bboxes_xyxy = tracked_objects[:, :4].tolist()
            track_ids = tracked_objects[:, 4].astype(int).tolist()
            # Sync Track IDs back to NvDsObjectMeta for nvdsosd
            self._sync_track_ids(frame_meta, tracked_objects)
        else:
            bboxes_xyxy = [[d[0], d[1], d[2], d[3]] for d in detections]
            track_ids = list(range(len(detections)))

        # 4. Run Counting Service — lightweight Python
        self.counting_service.update(bboxes_xyxy, track_ids)

        # 5. Calculate FPS
        self.frame_count += 1
        if self.frame_count % 30 == 0:
            elapsed = time.time() - self.fps_start_time
            self.current_fps = 30.0 / elapsed if elapsed > 0 else 0.0
            self.fps_start_time = time.time()
            current_people = self.counting_service.current_people
            logger.info(f"[Probe] Frame #{frame_id} | FPS: {self.current_fps:.1f} | Detections: {len(detections)} | Tracked: {len(tracked_objects)} | In: {self.counting_service.count_in} | Out: {self.counting_service.count_out} | Occ: {current_people}")

        # 6. Draw OSD metadata (Counting Line, Counts) — lightweight
        self._draw_osd(frame_meta, batch_meta)

        # 7. Enqueue Mapping + Publishing to background thread (NON-BLOCKING)
        self._enqueue_analytics_job(timestamp, frame_meta, bboxes_xyxy, track_ids)

    # ─── Background Analytics Worker ─────────────────────────────

    def _enqueue_analytics_job(self, timestamp, frame_meta, bboxes_xyxy, track_ids):
        """
        Push a lightweight job dict to the analytics queue.
        We snapshot all needed data here because frame_meta is only valid
        during this GStreamer callback.
        """
        job = {
            "timestamp": timestamp,
            "bboxes": bboxes_xyxy,
            "track_ids": track_ids,
            "video_size": (frame_meta.source_frame_width, frame_meta.source_frame_height),
            "count_in": self.counting_service.count_in,
            "count_out": self.counting_service.count_out,
            "occupancy": self.counting_service.current_people,
            "fps": self.current_fps if self.current_fps > 0 else None,
        }
        try:
            self._analytics_queue.put_nowait(job)
        except queue.Full:
            # Drop oldest job to keep latest data
            try:
                self._analytics_queue.get_nowait()
            except queue.Empty:
                pass
            self._analytics_queue.put_nowait(job)

    def _analytics_worker(self):
        """
        SLOW PATH (background thread): Mapping → Serialize → Publish.
        Runs independently from GStreamer to avoid blocking the pipeline.
        """
        logger.info("[Probe] Analytics worker thread started.")
        while not self._stop_event.is_set():
            try:
                job = self._analytics_queue.get(timeout=1.0)
            except queue.Empty:
                continue

            try:
                self._process_analytics_job(job)
            except Exception as e:
                logger.error(f"[Probe:Worker] Error processing analytics job: {e}")

    def _process_analytics_job(self, job: dict):
        """Execute Mapping + Publishing for one frame's data."""
        bboxes = job["bboxes"]
        track_ids = job["track_ids"]
        video_size = job["video_size"]
        timestamp = job["timestamp"]

        if not bboxes:
            # Empty frame
            frame_data = FrameData(
                timestamp=timestamp,
                count_in=job["count_in"],
                count_out=job["count_out"],
                occupancy=job["occupancy"],
                height_frame=video_size[1],
                width_frame=video_size[0],
                objects=[],
                alert="none"
            )
            self.publisher.send_frame(frame_data)
            return

        # 1. Run Mapping Service (Homography projection)
        map_size = self.mapping_service._map_size
        map_coords = self.mapping_service.project_bboxes(
            bboxes=bboxes,
            frame_size=video_size,
            map_size=map_size,
        )

        # 2. Construct Objects List for Backend
        objects = []
        for bbox, tid, coords in zip(bboxes, track_ids, map_coords):
            objects.append(
                ObjectDetection(
                    track_id=tid,
                    bbox=bbox,
                    coordinates_2D=[float(coords[0]), float(coords[1])]
                )
            )

        # 3. Calculate Alert Status
        occupancy = job["occupancy"]
        alert = "info"
        if occupancy >= self.critical_threshold:
            alert = "critical"
        elif occupancy >= self.warning_threshold:
            alert = "warning"

        # 4. Create FrameData
        frame_data = FrameData(
            timestamp=timestamp,
            count_in=job["count_in"],
            count_out=job["count_out"],
            occupancy=occupancy,
            height_frame=video_size[1],
            width_frame=video_size[0],
            height_2D=self.mapping_service._map_size[1] if self.mapping_service._map_size else 0,
            width_2D=self.mapping_service._map_size[0] if self.mapping_service._map_size else 0,
            objects=objects,
            alert=alert,
            fps=job["fps"]
        )

        # 5. Publish (non-blocking, goes to publisher's own queue)
        self.publisher.send_frame(frame_data)

    def _sync_track_ids(self, frame_meta, tracked_objects):
        """
        Update NvDsObjectMeta with OCSort Track IDs and per-ID colors.
        Uses vectorized NumPy distance matrix instead of O(N*M) Python loop.
        """
        if len(tracked_objects) == 0:
            return

        # Pre-compute ALL track centers as a NumPy array (M, 2)
        track_cx = (tracked_objects[:, 0] + tracked_objects[:, 2]) / 2.0
        track_cy = (tracked_objects[:, 1] + tracked_objects[:, 3]) / 2.0
        track_centers = np.stack([track_cx, track_cy], axis=1)  # (M, 2)
        track_ids_arr = tracked_objects[:, 4].astype(int)

        l_obj = frame_meta.obj_meta_list
        while l_obj is not None:
            try:
                obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
                rect = obj_meta.rect_params
                cx = rect.left + rect.width / 2.0
                cy = rect.top + rect.height / 2.0
                
                # Vectorized distance: broadcast (1, 2) - (M, 2) → (M,)
                det_center = np.array([cx, cy])
                dists = np.sum((track_centers - det_center) ** 2, axis=1)
                best_idx = np.argmin(dists)
                best_tid = int(track_ids_arr[best_idx])
                
                if best_tid >= 0:
                    obj_meta.object_id = best_tid
                    
                    # Unique color per track ID
                    color = self.color_palette[best_tid % len(self.color_palette)]
                    rect.border_color.set(*color)
                    rect.border_width = 3
                    
                    # ID label with colored background
                    obj_meta.text_params.display_text = f"ID:{best_tid}"
                    obj_meta.text_params.font_params.font_name = "Serif"
                    obj_meta.text_params.font_params.font_size = 12
                    obj_meta.text_params.font_params.font_color.set(1.0, 1.0, 1.0, 1.0)
                    obj_meta.text_params.set_bg_clr = 1
                    obj_meta.text_params.text_bg_clr.set(color[0], color[1], color[2], 0.6)
                
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

    def stop(self):
        """Stop the background analytics worker thread."""
        self._stop_event.set()
        self._analytics_thread.join(timeout=3.0)
        logger.info("[Probe] Analytics worker thread stopped.")
