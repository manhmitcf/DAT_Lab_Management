import numpy as np
import cv2
from typing import Tuple, Optional
from utils.utils import scale_points
from config.data_config import CountingConfig

class LineCounter:
    """
    Count objects crossing a line.
    State-based: each object is marked inside/outside; only clear transitions across the margin are counted.
    """

    def __init__(self, start_point, end_point, inside_point, crossing_margin=10):
        """
        Args:
            start_point: Line start point (x1, y1)
            end_point: Line end point (x2, y2)
            inside_point: A point on the inside side (defines IN/OUT direction)
            crossing_margin: Half-width of the no-decision band around the line (pixels);
                             an object must cross this band to be counted.
        """
        self.start_point = np.array(start_point, dtype=np.float64)
        self.end_point = np.array(end_point, dtype=np.float64)
        self.crossing_margin = crossing_margin

        self.line_vector = self.end_point - self.start_point
        self.line_length = np.linalg.norm(self.line_vector)
        if self.line_length == 0:
            raise ValueError("line start and end must not be identical")
        self.unit_line_vector = self.line_vector / self.line_length
        self.normal_vector = np.array([-self.unit_line_vector[1], self.unit_line_vector[0]])

        inside_distance = self.get_distance_from_line(inside_point)
        self.in_sign = 1 if inside_distance > 0 else -1

        # States per track_id
        self.object_states = {}

        self.entry_count = 0
        self.exit_count = 0

    def get_distance_from_line(self, point):
        """Signed distance from a point to the line."""
        point = np.array(point, dtype=np.float64)
        return np.dot(point - self.start_point, self.normal_vector)

    def update(self, object_id, center_point):
        """
        Update an object's position and check for crossings.

        Args:
            object_id: Track ID
            center_point: (x, y) — typically the bottom-center (person feet)

        Returns:
            "enter" — if outside → inside
            "exit"  — if inside → outside
            False   — otherwise
        """
        current_distance = self.get_distance_from_line(center_point)
        relative_dist = current_distance * self.in_sign

        # Determine current state based on margin
        current_state = None
        if relative_dist > self.crossing_margin:
            current_state = "inside"
        elif relative_dist < -self.crossing_margin:
            current_state = "outside"

        # In the no-decision band → skip
        if current_state is None:
            return False

        # Get previous state
        prev_state = self.object_states.get(object_id)

        # First time seeing this ID → store initial state, do not count
        if prev_state is None:
            self.object_states[object_id] = current_state
            return False

        # Clear state changes → count and update state immediately
        if prev_state == "outside" and current_state == "inside":
            self.entry_count += 1
            self.object_states[object_id] = "inside"
            return "enter"

        elif prev_state == "inside" and current_state == "outside":
            self.exit_count += 1
            self.object_states[object_id] = "outside"
            return "exit"

        # State unchanged
        self.object_states[object_id] = current_state
        return False

    def reset(self):
        """Reset all counting state."""
        self.object_states.clear()
        self.entry_count = 0
        self.exit_count = 0

    def update_line(self, start_point, end_point, inside_point, crossing_margin=None):
        """Update line geometry and derived vectors at runtime."""
        self.start_point = np.array(start_point, dtype=np.float64)
        self.end_point = np.array(end_point, dtype=np.float64)
        if crossing_margin is not None:
            self.crossing_margin = crossing_margin

        self.line_vector = self.end_point - self.start_point
        self.line_length = np.linalg.norm(self.line_vector)
        if self.line_length == 0:
            raise ValueError("start_point and end_point must not be identical")

        self.unit_line_vector = self.line_vector / self.line_length
        self.normal_vector = np.array([-self.unit_line_vector[1], self.unit_line_vector[0]])

        inside_distance = self.get_distance_from_line(inside_point)
        self.in_sign = 1 if inside_distance > 0 else -1

        # Optionally clear previous object states because the line changed
        self.object_states.clear()

class CountingService:
    """
    Service to count entries/exits across a counting line.
    Decoupled: it does not care where config comes from; it only receives scaled coordinates.
    """

    def __init__(
        self,
        counting_config: Optional[CountingConfig] = None,
        *,
        line_start: Optional[tuple] = None,
        line_end: Optional[tuple] = None,
        inside_point: Optional[tuple] = None,
        crossing_margin: int = 10,
        source_frame_size: Optional[Tuple[int, int]] = None,
        current_frame_size: Optional[Tuple[int, int]] = None,
        normalized: bool = False,
    ):
        """Initialize with a CountingConfig or explicit geometry. If config is provided, scaling to current_frame_size is applied automatically."""

        if counting_config is not None:
            line_start = counting_config.line_start
            line_end = counting_config.line_end
            inside_point = counting_config.inside_point
            crossing_margin = counting_config.crossing_margin
            normalized = getattr(counting_config, "normalized", False)
            if getattr(counting_config, "frame_width", None) and getattr(counting_config, "frame_height", None):
                source_frame_size = (counting_config.frame_width, counting_config.frame_height)

        if line_start is None or line_end is None or inside_point is None:
            raise ValueError("line_start, line_end, and inside_point are required")

        start, end, inside = self._scale_geometry(
            line_start,
            line_end,
            inside_point,
            source_frame_size=source_frame_size,
            current_frame_size=current_frame_size,
            normalized=normalized,
        )

        self.line_counter = LineCounter(
            start_point=start,
            end_point=end,
            inside_point=inside,
            crossing_margin=crossing_margin,
        )

    @staticmethod
    def _scale_geometry(
        line_start: tuple,
        line_end: tuple,
        inside_point: tuple,
        source_frame_size: Optional[Tuple[int, int]],
        current_frame_size: Optional[Tuple[int, int]],
        normalized: bool,
    ) -> Tuple[tuple, tuple, tuple]:
        """Scale geometry from source frame to current frame or from normalized coordinates."""
        if normalized:
            if current_frame_size is None:
                raise ValueError("current_frame_size is required when using normalized coordinates")
            dst_w, dst_h = current_frame_size
            scale = (dst_w, dst_h)
            pts = np.array([line_start, line_end, inside_point], dtype=np.float64) * np.array(scale, dtype=np.float64)
            return tuple(pts[0]), tuple(pts[1]), tuple(pts[2])

        if current_frame_size is None:
            # No scaling requested
            return line_start, line_end, inside_point

        if source_frame_size is None:
            # Assume already in current frame size
            return line_start, line_end, inside_point

        scaled_pts = scale_points(
            points=[line_start, line_end, inside_point],
            src_size=source_frame_size,
            dst_size=current_frame_size,
        )
        return tuple(scaled_pts[0]), tuple(scaled_pts[1]), tuple(scaled_pts[2])

    def update(self, bboxes: list, track_ids: list):
        """
        Update counting for one batch of detections.
        Args:
            bboxes: List of bounding boxes [x, y, w, h] (tlwh format).
            track_ids: List of track IDs corresponding to each bbox.
        """
        for bbox, tid in zip(bboxes, track_ids):
            x, y, w, h = bbox

            # Bottom-center
            cx = int(x + w / 2)
            cy = int(y + h)

            self.line_counter.update(int(tid), (cx, cy))

    def draw_margin_region(self, frame, color=(255, 0, 255), thickness=1):
        """
        Draw the counting margin region on the frame.

        Args:
            frame: OpenCV image to draw on
            color: BGR color tuple (default: magenta)
            thickness: Line thickness

        Returns:
            frame with margin region drawn
        """
        n = self.line_counter.normal_vector
        r = self.line_counter.crossing_margin
        pts_top, pts_bot = [], []

        for t in np.linspace(0, 1, 50):
            pt = self.line_counter.start_point + t * self.line_counter.line_vector
            pts_top.append((pt + n * r).astype(int))
            pts_bot.append((pt - n * r).astype(int))

        region_pts = np.array(pts_top + pts_bot[::-1], dtype=np.int32)
        cv2.polylines(frame, [region_pts], True, color, thickness)

        return frame


    @property
    def count_in(self) -> int:
        return self.line_counter.entry_count

    @property
    def count_out(self) -> int:
        return self.line_counter.exit_count

    @property
    def current_people(self) -> int:
        return max(0, self.line_counter.entry_count - self.line_counter.exit_count)

    def reset(self):
        """Reset counts and states."""
        self.line_counter.reset()

    def update_config(
        self,
        line_start: tuple,
        line_end: tuple,
        inside_point: tuple,
        crossing_margin: int = 10,
        source_frame_size: Optional[Tuple[int, int]] = None,
        current_frame_size: Optional[Tuple[int, int]] = None,
        normalized: bool = False,
    ):
        """Update all line parameters (coordinates, margin) at runtime with optional scaling to the current frame size."""
        start, end, inside = self._scale_geometry(
            line_start,
            line_end,
            inside_point,
            source_frame_size=source_frame_size,
            current_frame_size=current_frame_size,
            normalized=normalized,
        )
        self.line_counter.update_line(start, end, inside, crossing_margin)


    @classmethod
    def from_config(
        cls,
        config,
        current_frame_size: Optional[Tuple[int, int]] = None,
    ):
        """Construct from a CountingConfig; kept for backward compatibility."""
        return cls(counting_config=config, current_frame_size=current_frame_size)
