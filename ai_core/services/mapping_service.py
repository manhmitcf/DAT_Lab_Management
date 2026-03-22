import cv2
import numpy as np
from typing import Optional, List, Tuple
from config.data_config import MappingConfig

class MappingService:
    """Maps camera pixel coordinates to a 2D map using a homography matrix."""

    def __init__(self, mapping_config: MappingConfig) -> None:
        self._homography_matrix: Optional[np.ndarray] = None
        self._camera_points: Optional[np.ndarray] = None
        self._map_points: Optional[np.ndarray] = None
        self._inlier_mask: Optional[np.ndarray] = None
        self._camera_size: Optional[Tuple[int, int]] = None
        self._map_size: Optional[Tuple[int, int]] = None

        if mapping_config is None:
            raise ValueError("mapping_config is required")

        self.load_from_config(mapping_config)
        self._compute_homography()


    def project(self, x: float, y: float, current_frame_size: Tuple[int, int], current_map_size: Tuple[int, int]) -> List[float]:
        """Project a single point (x, y) from camera space to map space."""
        if self._homography_matrix is None:
            return [x, y]

        cur_w, cur_h = current_frame_size
        cam_w, cam_h = self._camera_size

        # scale về hệ tọa độ lúc label
        x = x * cam_w / cur_w
        y = y * cam_h / cur_h

        mapped = self._project_homography(x, y)

        # Scale output map point về map runtime size
        map_w_label, map_h_label = self._map_size
        map_w_runtime, map_h_runtime = current_map_size

        mapped[0] = mapped[0] * map_w_runtime / map_w_label
        mapped[1] = mapped[1] * map_h_runtime / map_h_label

        return mapped

    def project_bbox(self, bbox: Tuple[float, float, float, float],
                     current_frame_size: Tuple[int, int],
                     current_map_size: Tuple[int, int]) -> List[float]:
        """Project a bounding box using its foot point, scaled to runtime frame/map size."""
        x1, y1, x2, y2 = bbox
        foot_x = (x1 + x2) / 2.0
        foot_y = y2
        return self.project(foot_x, foot_y, current_frame_size, current_map_size)

    def project_batch(self, points: List[Tuple[float, float]],
                      current_frame_size: Tuple[int, int],
                      current_map_size: Tuple[int, int]) -> List[List[float]]:
        """Project multiple points at once, scaled to runtime frame/map size."""
        if not points:
            return []
        if self._homography_matrix is None:
            return [[float(x), float(y)] for x, y in points]

        return [self.project(x, y, current_frame_size, current_map_size) for x, y in points]

    def project_bboxes(self, bboxes: List[Tuple[float, float, float, float]],
                       current_frame_size: Tuple[int, int],
                       current_map_size: Tuple[int, int]) -> List[List[float]]:
        """Project multiple bounding boxes using their foot points, scaled to runtime frame/map size."""
        foot_points = [((x1 + x2) / 2.0, y2) for x1, _, x2, y2 in bboxes]
        return self.project_batch(foot_points, current_frame_size, current_map_size)

    @property
    def is_ready(self) -> bool:
        return self._homography_matrix is not None

    @property
    def homography_matrix(self) -> Optional[np.ndarray]:
        return self._homography_matrix

    @property
    def camera_points(self) -> Optional[np.ndarray]:
        return self._camera_points

    @property
    def map_points(self) -> Optional[np.ndarray]:
        return self._map_points

    @property
    def num_correspondences(self) -> int:
        return len(self._camera_points) if self._camera_points is not None else 0

    @property
    def num_inliers(self) -> int:
        return int(np.sum(self._inlier_mask)) if self._inlier_mask is not None else 0

    @property
    def map_size(self) -> Optional[Tuple[int, int]]:
        return self._map_size

    @property
    def camera_size(self) -> Optional[Tuple[int, int]]:
        return self._camera_size

    def load_from_config(self, config: MappingConfig) -> None:
        """Load mapping data from a MappingConfig instance."""
        if not config.camera_points or not config.map_points:
            raise ValueError("MappingConfig must include camera_points and map_points")
        if len(config.camera_points) != len(config.map_points):
            raise ValueError("camera_points and map_points must have the same length")
        if len(config.camera_points) < 4:
            raise ValueError(f"Need at least 4 correspondence points, got {len(config.camera_points)}")
        if config.camera_size is None or config.map_size is None:
            raise ValueError("MappingConfig must include camera_size and map_size")

        cam_w, cam_h = config.camera_size
        map_w, map_h = config.map_size
        if cam_w <= 0 or cam_h <= 0:
            raise ValueError(f"Invalid camera_size: {config.camera_size}")
        if map_w <= 0 or map_h <= 0:
            raise ValueError(f"Invalid map_size: {config.map_size}")

        self._camera_points = np.array(config.camera_points, dtype=np.float32)
        self._map_points = np.array(config.map_points, dtype=np.float32)
        self._camera_size = (int(cam_w), int(cam_h))
        self._map_size = (int(map_w), int(map_h))

    def _compute_homography(self) -> None:
        """Compute homography from loaded correspondence points."""
        if self._camera_points is None or self._map_points is None:
            raise ValueError("Camera and map points must be loaded before computing homography")

        H, mask = cv2.findHomography(self._camera_points, self._map_points, cv2.RANSAC, 5.0)
        if H is None:
            raise RuntimeError("Failed to compute homography matrix")

        self._homography_matrix = H
        self._inlier_mask = mask

    def _project_homography(self, x: float, y: float) -> List[float]:
        point = np.array([[[x, y]]], dtype=np.float32)
        mapped = cv2.perspectiveTransform(point, self._homography_matrix)
        return [float(mapped[0][0][0]), float(mapped[0][0][1])]

    def update_mapping(self,
                       camera_points: List[Tuple[float, float]],
                       map_points: List[Tuple[float, float]],
                       camera_size: Optional[Tuple[int, int]],
                       map_size: Optional[Tuple[int, int]]) -> None:
        """Replace mapping data and recompute the homography."""
        if len(camera_points) != len(map_points):
            raise ValueError("camera_points and map_points must have the same length")
        if len(camera_points) < 4:
            raise ValueError(f"Need at least 4 correspondence points, got {len(camera_points)}")

        cam_w, cam_h = camera_size
        map_w, map_h = map_size

        if cam_w <= 0 or cam_h <= 0:
            raise ValueError(f"Invalid camera_size: {camera_size}")

        if map_w <= 0 or map_h <= 0:
            raise ValueError(f"Invalid map_size: {map_size}")

        self._camera_points = np.array(camera_points, dtype=np.float32)
        self._map_points = np.array(map_points, dtype=np.float32)

        self._camera_size = (int(cam_w), int(cam_h))
        self._map_size = (int(map_w), int(map_h))

        self._compute_homography()
