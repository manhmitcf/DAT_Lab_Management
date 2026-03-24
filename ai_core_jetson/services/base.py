"""
Base Abstractions for AI Core Services.
Provides Abstract Base Classes (ABC) to strictly enforce OOP design,
PEP8 typing, and consistent input/output interfaces across the pipeline.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from schemas.schemas import ObjectDetection, FrameData
from core.config import (
    YOLOXConfig, 
    OCSortConfig, 
    CountingConfig, 
    MappingConfig
)


class BaseTrackingService(ABC):
    """
    Abstract Interface for Tracking Services.
    Whether using Python OCSort or C++ OCSort backend, they must implement this interface.
    """

    @abstractmethod
    def __init__(self, config: OCSortConfig) -> None:
        """
        Initialize the tracking service.

        Args:
            config (OCSortConfig): Configuration object containing thresholds, max_age, etc.
        """
        pass

    @abstractmethod
    def update(
        self, 
        detections: np.ndarray, 
        img_info: Tuple[int, int], 
        img_size: Tuple[int, int]
    ) -> np.ndarray:
        """
        Update the tracker with new detections for a single frame.

        Args:
            detections (np.ndarray): Tensor of shape (N, 6) -> [x1, y1, x2, y2, score, class_id].
            img_info (Tuple[int, int]): Original image dimensions (height, width).
            img_size (Tuple[int, int]): Inference target dimensions (e.g., 640, 640).

        Returns:
            np.ndarray: Tracked objects array of shape (M, 7) -> [x1, y1, x2, y2, track_id, class_id, score].
        """
        pass


class BaseCountingService(ABC):
    """
    Abstract Interface for Counting Services (e.g., line crossing, zone counting).
    """

    @abstractmethod
    def __init__(self, config: CountingConfig) -> None:
        """
        Initialize the counting service.
        """
        pass

    @abstractmethod
    def update(self, bboxes: List[List[float]], track_ids: List[int]) -> None:
        """
        Update the internal state machine with new tracking data to compute counts.

        Args:
            bboxes (List[List[float]]): List of bounding boxes [x, y, w, h] or [x1, y1, x2, y2].
            track_ids (List[int]): List of corresponding track IDs.
        """
        pass

    @abstractmethod
    def get_counts(self) -> Dict[str, int]:
        """
        Retrieve current counting statistics.

        Returns:
            Dict[str, int]: Dictionary mapping direction/class to count totals (e.g., {"in": 5, "out": 3}).
        """
        pass


class BaseMappingService(ABC):
    """
    Abstract Interface for Mapping Services (e.g., Homography translation to 2D map).
    """

    @abstractmethod
    def __init__(self, config: MappingConfig) -> None:
        """
        Initialize the mapping service with camera calibration data.
        """
        pass

    @abstractmethod
    def project_bboxes(
        self, 
        bboxes: List[List[float]], 
        frame_size: Tuple[int, int], 
        map_size: Tuple[int, int]
    ) -> List[Tuple[float, float]]:
        """
        Project bounding boxes from camera pixel coordinates to 2D map coordinates.

        Args:
            bboxes: List of bounding boxes.
            frame_size: Dimensions of the camera frame.
            map_size: Dimensions of the target 2D map.

        Returns:
            List[Tuple[float, float]]: List of projected (X, Y) map coordinates.
        """
        pass


class BaseResultPublisher(ABC):
    """
    Abstract Interface for publishing pipeline results (e.g., WebSocket, MQTT, HTTP).
    """

    @abstractmethod
    def send_frame(self, frame_data: FrameData) -> None:
        """
        Publish frame data containing tracks, counts, and system status.

        Args:
            frame_data (FrameData): Pydantic or Dataclass model representing the frame payload.
        """
        pass
