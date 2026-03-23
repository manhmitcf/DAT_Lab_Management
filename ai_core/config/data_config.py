import json
from dataclasses import dataclass
from typing import Optional, Tuple, List

# === START OF REFACTOR ===
# This class now only holds parameters that are used by the Python-based filtering logic.
# All C++ tracker parameters have been moved to deploy/DeepStream/config_tracker_ocsort_params.txt
@dataclass
class OCSortConfig:
    """Configuration for Python-side tracker result filtering."""
    json_path: Optional[str] = "config/tracking_config.json"
    
    aspect_ratio_thresh: float = 1.6
    min_box_area: float = 100.0

    def __post_init__(self):
        if self.json_path is None:
            return
        try:
            with open(self.json_path, "r") as f:
                config = json.load(f)
            for key, value in config.items():
                key = key.replace("-", "_")
                if hasattr(self, key):
                    setattr(self, key, value)
        except FileNotFoundError:
            # It's fine if the file doesn't exist, we'll use the defaults.
            pass
        except Exception as e:
            print(f"Error loading tracking config: {e}")
# === END OF REFACTOR ===

@dataclass
class CountingConfig:
    """Config for CountingService loaded from JSON."""
    json_path: Optional[str] = None
    line_start: Tuple[float, float] = (0.0, 0.0)
    line_end: Tuple[float, float] = (0.0, 0.0)
    inside_point: Tuple[float, float] = (0.0, 0.0)
    crossing_margin: float = 10.0
    frame_height: Optional[int] = None
    normalized: bool = False
    info_threshold: Optional[int] = None
    warning_threshold: Optional[int] = None
    critical_threshold: Optional[int] = None

    def __post_init__(self):
        if self.json_path is None:
            return
        try:
            with open(self.json_path, "r") as f:
                config = json.load(f)
            for key, value in config.items():
                key = key.replace("-", "_")
                if hasattr(self, key):
                    setattr(self, key, value)
        except FileNotFoundError:
            pass
        except Exception as e:
            print(f"Error loading counting config: {e}")

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
        try:
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

        except FileNotFoundError:
            pass
        except Exception as e:
            print(f"Error loading mapping config: {e}")
