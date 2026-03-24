"""
Base Abstractions for Analytics Services.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from core.config import OCSortConfig, CountingConfig, MappingConfig


class BaseTrackingService(ABC):
    @abstractmethod
    def __init__(self, config: OCSortConfig) -> None:
        pass

    @abstractmethod
    def update(
        self, 
        detections: np.ndarray, 
    ) -> np.ndarray:
        pass


class BaseCountingService(ABC):
    @abstractmethod
    def __init__(self, config: CountingConfig) -> None:
        pass

    @abstractmethod
    def update(self, bboxes: List[List[float]], track_ids: List[int]) -> None:
        pass

    @abstractmethod
    def get_counts(self) -> Dict[str, int]:
        pass


class BaseMappingService(ABC):
    @abstractmethod
    def __init__(self, config: MappingConfig) -> None:
        pass

    @abstractmethod
    def project_bboxes(
        self, 
        bboxes: List[List[float]], 
        frame_size: Tuple[int, int], 
    ) -> List[Tuple[float, float]]:
        pass
