from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import List, Optional, Literal, Union
from datetime import datetime, timezone

# Define Alert Levels
AlertType = Literal['none', 'info', 'warning', 'critical']

class ObjectDetection(BaseModel):
    """
    Detailed information for each detected object within a video frame.
    """
    model_config = ConfigDict(populate_by_name=True)

    track_id: int = Field(..., description="Unique tracking ID")

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
    Standardized JSON structure sent from Edge Device for persistence.
    """
    # UTC timestamp of the inference process
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="UTC inference timestamp")

    # Line crossing statistics (Realtime count)
    count_in: int = Field(0, description="Cumulative count of entries")
    count_out: int = Field(0, description="Cumulative count of exits")

    # Alert level
    alert: AlertType = Field('none', description="Alert level (none, info, warning, critical)")

    # Flag to signal the Backend to persist data in PostgreSQL for Heatmap/Analytics
    save_to_db: bool = Field(True, description="true = save to DB, false = do nothing")

    # Original frame dimensions
    height_frame: Optional[int] = Field(None, description="Height of the original frame in pixels")
    width_frame: Optional[int] = Field(None, description="Width of the original frame in pixels")

    # 2D map dimensions
    height_2D: Optional[int] = Field(None, description="Height of the 2D map in pixels")
    width_2D: Optional[int] = Field(None, description="Width of the 2D map in pixels")

    # List of detected objects
    objects: List[ObjectDetection] = Field(default_factory=list)

# Schemas for Calibration/Mapping API

class Shape(BaseModel):
    """
    Represents a single corresponding shape (point or line) between the
    camera view and the floor plan. Coordinates can be floats.
    """
    type: Literal["point", "line"]
    camera: List[List[Union[int, float]]]
    floor_plan: List[List[Union[int, float]]]

class MappingRequest(BaseModel):
    """
    Request body for the calibration endpoint. Contains a list of shapes
    used to compute the homography matrix.
    """
    shapes: List[Shape] = Field(..., min_length=4, description="At least 4 shapes are required for homography calculation.")

    @field_validator('shapes')
    def validate_shapes(cls, v):
        for shape in v:
            if len(shape.camera) != len(shape.floor_plan):
                raise ValueError("Camera and floor_plan must have the same number of points for a given shape.")

            if shape.type == "point":
                if len(shape.camera) != 1 or len(shape.camera[0]) != 2:
                    raise ValueError("Shape type 'point' must have exactly one coordinate pair [x, y].")
            elif shape.type == "line":
                if len(shape.camera) != 2 or not (len(shape.camera[0]) == 2 and len(shape.camera[1]) == 2):
                    raise ValueError("Shape type 'line' must have exactly two coordinate pairs [x, y].")
            else:
                raise ValueError(f"Invalid shape type: {shape.type}")
        return v

class CalibrationSuccessResponse(BaseModel):
    """
    Standard success response for the calibration endpoint.
    """
    status: Literal["ok"] = "ok"
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ErrorDetail(BaseModel):
    """
    Detailed error information for API responses.
    """
    code: str
    message: str

class ErrorResponse(BaseModel):
    """
    Standard error response schema.
    """
    error: ErrorDetail
