from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone

class ObjectDetection(BaseModel):
    """
    Detailed information for each detected object within a video frame.
    """
    model_config = ConfigDict(populate_by_name=True)

    track_id: int = Field(..., description="Unique tracking ID")

    # Object class (person, vehicle, ...)
    class_name: str = Field("person", alias="class", description="Object class name")

    conf: float = Field(..., ge=0, le=1)

    # Pixel-based bounding box
    bbox: List[float] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="[x1, y1, x2, y2] in pixels"
    )

    # 2D map projected coordinates
    coordinates_2D: Optional[List[float]] = Field(
        None,
        min_length=2,
        max_length=2,
        description="[x, y] center projected onto 2D map"
    )

class FrameData(BaseModel):
    """
    Standardized JSON structure sent from Edge Device via WebSocket for each frame.
    Designed for a single-camera setup.
    Schema as per backend API requirements.
    """
    # Sequential ID of the frame from the start of the stream
    frame_id: int = Field(..., description="Sequential frame index")

    # UTC timestamp of the inference process
    # Use default_factory with lambda to get current time at instantiation
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="UTC inference timestamp")

    # Line crossing statistics (Realtime count)
    count_in: int = Field(0, description="Cumulative count of entries")
    count_out: int = Field(0, description="Cumulative count of exits")

    # Alert flag
    alert: bool = Field(False, description="Alert flag for abnormal events")

    # Flag to signal the Backend to persist data in PostgreSQL for Heatmap/Analytics
    save_to_db: bool = Field(False, description="true = save to DB, false = forward realtime only")

    # Original frame dimensions (for Frontend to draw correctly)
    height_frame: Optional[int] = Field(None, description="Height of the original frame in pixels")
    width_frame: Optional[int] = Field(None, description="Width of the original frame in pixels")

    # 2D map dimensions (for Frontend to draw correctly)
    height_2D: Optional[int] = Field(None, description="Height of the 2D map in pixels")
    width_2D: Optional[int] = Field(None, description="Width of the 2D map in pixels")

    # Base64 Image (Optional - Used for realtime display)
    frame_image: Optional[str] = Field(None, description="Base64 encoded frame image")

    # List of detected objects
    objects: List[ObjectDetection] = Field(default_factory=list)
