from celery import shared_task
from django.db import transaction
from .models import FrameData, ObjectDetection
from .schemas import FrameData as FrameDataSchema
from pydantic import ValidationError
import logging

logger = logging.getLogger(__name__)

@shared_task
def save_frame_task(frame_data_json):
    """
    Celery task to save frame data to the database asynchronously.
    """
    try:
        # Validate data
        frame_schema = FrameDataSchema.model_validate(frame_data_json)
        
        with transaction.atomic():
            # Create FrameData instance
            frame = FrameData.objects.create(
                timestamp=frame_schema.timestamp,
                count_in=frame_schema.count_in,
                count_out=frame_schema.count_out,
                occupancy=frame_schema.occupancy,
                fps=frame_schema.fps,
                alert=frame_schema.alert,
                height_frame=frame_schema.height_frame,
                width_frame=frame_schema.width_frame,
                height_2D=frame_schema.height_2D,
                width_2D=frame_schema.width_2D
            )

            # Create ObjectDetection instances
            object_instances = []
            for obj in frame_schema.objects:
                object_instances.append(ObjectDetection(
                    frame_data=frame,
                    track_id=obj.track_id,
                    bbox=obj.bbox,
                    coordinates_2D=obj.coordinates_2D
                ))

            if object_instances:
                ObjectDetection.objects.bulk_create(object_instances)

            logger.info(f"Celery: Saved frame at {frame.timestamp}")

    except ValidationError as e:
        logger.error(f"Celery Validation Error: {e}")
    except Exception as e:
        logger.error(f"Celery DB Save Error: {e}")
