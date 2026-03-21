from typing import Optional, Tuple, List
from datetime import datetime, timezone
import numpy as np
from loguru import logger
from services.tracking_service import TrackingService
from services.counting_service import CountingService
from services.mapping_service import MappingService
from config.data_config import OCSortConfig, CountingConfig, MappingConfig
from schemas.schemas import FrameData, ObjectDetection


class PipelineService:
    """Orchestrates tracking, counting, and mapping to produce FrameData."""

    def __init__(
        self,
        tracking_config: OCSortConfig,
        counting_config: CountingConfig,
        mapping_config: MappingConfig,
        video_size: Tuple[int, int],
        map_size: Tuple[int, int],
        info_threshold: Optional[int] = None,
        warning_threshold: Optional[int] = None,
        critical_threshold: Optional[int] = None,
    ) -> None:
        self.video_size = video_size
        self.map_size = map_size or mapping_config.map_size
        if self.map_size is None:
            raise ValueError("map_size is required")

        self.counting_config = counting_config
        self.mapping_config = mapping_config

        self.info_threshold = info_threshold
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold

        self.tracking_service = TrackingService(args=tracking_config)
        self.counting_service = CountingService(counting_config=counting_config, current_frame_size=video_size)
        self.mapping_service = MappingService(mapping_config=mapping_config)

        logger.info(
            "Pipeline initialized video_size=%s map_size=%s thresholds(info=%s warning=%s critical=%s)",
            self.video_size,
            self.map_size,
            self.info_threshold,
            self.warning_threshold,
            self.critical_threshold,
        )

    def update_video_size(self, video_size: Tuple[int, int]) -> None:
        """Update current video size and rescale counting geometry accordingly."""
        self.video_size = video_size
        if self.counting_config is not None:
            self.counting_service = CountingService(counting_config=self.counting_config, current_frame_size=self.video_size)
        logger.info("Updated video_size to %s", self.video_size)


    def update_alert_thresholds(
        self,
        info_threshold: Optional[int] = None,
        warning_threshold: Optional[int] = None,
        critical_threshold: Optional[int] = None,
    ) -> None:
        """Update alert thresholds used for FrameData.alert classification."""
        if info_threshold is not None:
            self.info_threshold = info_threshold
        if warning_threshold is not None:
            self.warning_threshold = warning_threshold
        if critical_threshold is not None:
            self.critical_threshold = critical_threshold
        logger.info(
            "Updated thresholds info=%s warning=%s critical=%s",
            self.info_threshold,
            self.warning_threshold,
            self.critical_threshold,
        )

    def process_frame(self, frame: np.ndarray, frame_id: int, timestamp: datetime = None) -> FrameData:
        """Run tracking, counting, and mapping on a single frame and return FrameData."""
        ts = timestamp or datetime.now(timezone.utc)

        bboxes_tlwh, track_ids, fps = self.tracking_service.predict(frame_id=frame_id, frame=frame, box_type="tlwh")
        self.counting_service.update(bboxes_tlwh, track_ids)

        bboxes_xyxy: List[List[float]] = []
        for (x, y, w, h) in bboxes_tlwh:
            bboxes_xyxy.append([float(x), float(y), float(x + w), float(y + h)])

        mapped_points = self.mapping_service.project_bboxes(
            bboxes=[tuple(b) for b in bboxes_xyxy],
            current_frame_size=self.video_size,
            current_map_size=self.map_size,
        )

        objects: List[ObjectDetection] = []
        for bbox, coords, tid in zip(bboxes_xyxy, mapped_points, track_ids):
            objects.append(
                ObjectDetection(
                    track_id=int(tid),
                    bbox=bbox,
                    coordinates_2D=[float(coords[0]), float(coords[1])],
                )
            )

        current_people = self.counting_service.current_people

        alert = "none"

        if self.critical_threshold is not None and current_people >= self.critical_threshold:
            alert = "critical"
        elif self.warning_threshold is not None and current_people >= self.warning_threshold:
            alert = "warning"
        elif self.info_threshold is not None and current_people < self.info_threshold:
            alert = "info"

        return FrameData(
            timestamp=ts,
            count_in=self.counting_service.count_in,
            count_out=self.counting_service.count_out,
            occupancy=current_people,
            fps=float(fps) if fps is not None else None,
            height_frame=self.video_size[1],
            width_frame=self.video_size[0],
            height_2D=self.map_size[1],
            width_2D=self.map_size[0],
            objects=objects,
            alert=alert,
        )
