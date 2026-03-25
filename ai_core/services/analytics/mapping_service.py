"""
Mapping Service Implementation.
Projects camera pixel coordinates to 2D map coordinates using
a Homography matrix computed from user-defined correspondences.

Logic is preserved 100% from the legacy ai_core MappingService.
"""

import cv2
import numpy as np
from typing import List, Tuple

from services.analytics.base import BaseMappingService
from core.config import MappingConfig


class MappingService(BaseMappingService):
    """
    Maps bounding box foot-points from camera pixel space to 2D map space
    using a RANSAC-computed Homography matrix.

    Input:  bboxes List[[x1, y1, x2, y2]], frame_size, map_size
    Output: List of (map_x, map_y) coordinates on the 2D floor plan.
    """

    def __init__(self, config: MappingConfig) -> None:
        """
        Initialize the mapping service.

        Args:
            config: Pydantic model loaded from mapping_config.json.
                    Must contain 'correspondences', 'image_size', and 'map_size'.
        """
        self.config = config

        if not config.correspondences or len(config.correspondences) < 4:
            raise ValueError(
                f"Need at least 4 correspondence points, got {len(config.correspondences)}."
            )

        self._camera_points = np.array(
            [c.camera for c in config.correspondences], dtype=np.float32
        )
        self._map_points = np.array(
            [c.map for c in config.correspondences], dtype=np.float32
        )

        self._camera_size: Tuple[int, int] = (
            config.image_size["width"], config.image_size["height"]
        )
        self._map_size: Tuple[int, int] = (
            config.map_size["width"], config.map_size["height"]
        )

        H, mask = cv2.findHomography(self._camera_points, self._map_points, cv2.RANSAC, 5.0)
        if H is None:
            raise RuntimeError("Failed to compute homography matrix from correspondence points.")
        self._homography_matrix = H
        self._inlier_mask = mask

        # Preallocate buffer for foot points (assume max 512 objects/frame)
        self._buffer = np.zeros((512, 2), dtype=np.float32)

    def _compute_total_homography(self, frame_size: Tuple[int, int], map_size: Tuple[int, int]):
        """Compute combined scale + homography matrix for batch transform."""
        cur_w, cur_h = frame_size
        cam_w, cam_h = self._camera_size
        map_w_label, map_h_label = self._map_size
        map_w_runtime, map_h_runtime = map_size

        # Scale camera runtime → label frame
        S_cam = np.array([
            [cam_w / cur_w, 0, 0],
            [0, cam_h / cur_h, 0],
            [0, 0, 1]
        ], dtype=np.float32)

        # Scale map label → runtime map
        S_map = np.array([
            [map_w_runtime / map_w_label, 0, 0],
            [0, map_h_runtime / map_h_label, 0],
            [0, 0, 1]
        ], dtype=np.float32)

        # Total homography
        return S_map @ self._homography_matrix @ S_cam

    def _perspective_transform_np(self, H, points: np.ndarray) -> np.ndarray:
        """Vectorized homography transform with NumPy (points shape N,2)."""
        pts_h = np.hstack([points, np.ones((points.shape[0], 1), dtype=np.float32)])
        mapped = pts_h @ H.T
        mapped[:, 0] /= mapped[:, 2]
        mapped[:, 1] /= mapped[:, 2]
        return mapped[:, :2]

    def project_bboxes(
            self,
            bboxes: List[List[float]],
            frame_size: Tuple[int, int],
            map_size: Tuple[int, int],
    ) -> List[Tuple[float, float]]:

        if not bboxes:
            return []

        N = len(bboxes)
        bboxes_np = np.array(bboxes, dtype=np.float32)

        # Reuse preallocated buffer
        self._buffer[:N, 0] = (bboxes_np[:, 0] + bboxes_np[:, 2]) / 2.0
        self._buffer[:N, 1] = bboxes_np[:, 3]

        # Compute combined homography
        H_total = self._compute_total_homography(frame_size, map_size)

        mapped = self._perspective_transform_np(H_total, self._buffer[:N])

        return [(float(x), float(y)) for x, y in mapped]

    def project_bbox(
            self,
            bbox: List[float],
            current_frame_size: Tuple[int, int],
            current_map_size: Tuple[int, int]
    ) -> List[float]:
        # Simply call batch version for 1 bbox
        return list(self.project_bboxes([bbox], current_frame_size, current_map_size)[0])

    @property
    def is_ready(self) -> bool:
        return self._homography_matrix is not None

    @property
    def num_correspondences(self) -> int:
        return len(self._camera_points)

    @property
    def num_inliers(self) -> int:
        return int(np.sum(self._inlier_mask)) if self._inlier_mask is not None else 0

    def update_mapping(
            self,
            camera_points: List[List[float]],
            map_points: List[List[float]],
            camera_size: Tuple[int, int],
            map_size: Tuple[int, int]
    ) -> None:
        if len(camera_points) != len(map_points):
            raise ValueError("camera_points and map_points must have same length")
        if len(camera_points) < 4:
            raise ValueError("At least 4 points needed")

        self._camera_points = np.array(camera_points, dtype=np.float32)
        self._map_points = np.array(map_points, dtype=np.float32)
        self._camera_size = camera_size
        self._map_size = map_size

        H, mask = cv2.findHomography(self._camera_points, self._map_points, cv2.RANSAC, 5.0)
        if H is None:
            raise RuntimeError("Failed to recompute homography")
        self._homography_matrix = H
        self._inlier_mask = mask
