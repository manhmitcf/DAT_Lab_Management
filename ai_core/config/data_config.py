import json
from dataclasses import dataclass
from typing import Optional, Tuple, List

@dataclass
class OCSortConfig:

    json_path: Optional[str] = None

    device: str = "gpu"

    # detection
    conf: float = 0.1
    nms: float = 0.7
    tsize: int = 640
    ckpt: Optional[str] = None

    # inference options
    fp16: bool = False
    fuse: bool = False
    trt: bool = False
    trt_file: Optional[str] = None

    # tracking
    track_thresh: float = 0.6
    iou_thresh: float = 0.3
    use_byte: bool = False
    aspect_ratio_thresh: float = 1.6
    min_box_area: float = 10

    def __post_init__(self):

        if self.json_path is None:
            return

        with open(self.json_path, "r") as f:
            config = json.load(f)

        for key, value in config.items():

            key = key.replace("-", "_")

            if hasattr(self, key):
                setattr(self, key, value)
            else:
                print(f"Unknown config key: {key}")

@dataclass
class CountingConfig:
    """Config for CountingService loaded from JSON."""

    json_path: Optional[str] = None

    line_start: Tuple[float, float] = (0.0, 0.0)
    line_end: Tuple[float, float] = (0.0, 0.0)
    inside_point: Tuple[float, float] = (0.0, 0.0)
    crossing_margin: float = 10.0

    frame_width: Optional[int] = None
    frame_height: Optional[int] = None
    normalized: bool = False  # if True, line points are in 0–1 range

    def __post_init__(self):
        if self.json_path is None:
            return

        with open(self.json_path, "r") as f:
            config = json.load(f)

        for key, value in config.items():
            key = key.replace("-", "_")
            if hasattr(self, key):
                setattr(self, key, value)
            else:
                print(f"Unknown config key: {key}")

@dataclass
class MappingConfig:
    """Config for MappingService loaded from mapping_config.json."""

    json_path: Optional[str] = None

    camera_points: Optional[List[Tuple[float, float]]] = None
    map_points: Optional[List[Tuple[float, float]]] = None
    camera_size: Optional[Tuple[int, int]] = None
    map_size: Optional[Tuple[int, int]] = None

    def __post_init__(self):
        if self.json_path is None:
            return

        with open(self.json_path, "r") as f:
            config = json.load(f)

        correspondences = config.get("correspondences", [])
        if not correspondences:
            raise ValueError("No correspondences found in mapping config")

        cam_pts: List[Tuple[float, float]] = []
        map_pts: List[Tuple[float, float]] = []

        for item in correspondences:
            cam = item["camera"]
            mp = item["map"]
            if len(cam) != 2 or len(mp) != 2:
                raise ValueError("Each correspondence must contain camera and map points [x, y]")
            cam_pts.append((float(cam[0]), float(cam[1])))
            map_pts.append((float(mp[0]), float(mp[1])))

        if len(cam_pts) < 4:
            raise ValueError(f"Need at least 4 correspondence points, got {len(cam_pts)}")

        self.camera_points = cam_pts
        self.map_points = map_pts

        image_size = config.get("image_size")
        map_size = config.get("map_size")
        if image_size is None or map_size is None:
            raise ValueError("Both image_size and map_size are required in mapping config")

        self.camera_size = (int(image_size["width"]), int(image_size["height"]))
        self.map_size = (int(map_size["width"]), int(map_size["height"]))

        if self.camera_size[0] <= 0 or self.camera_size[1] <= 0:
            raise ValueError(f"Invalid camera_size: {self.camera_size}")
        if self.map_size[0] <= 0 or self.map_size[1] <= 0:
            raise ValueError(f"Invalid map_size: {self.map_size}")
