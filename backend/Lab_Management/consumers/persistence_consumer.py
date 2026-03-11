import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from pydantic import ValidationError
import logging

from ..schemas import FrameData
from ..tasks import save_frame_task

logger = logging.getLogger(__name__)

class PersistenceConsumer(AsyncJsonWebsocketConsumer):
    """
    This consumer's sole purpose is to receive metadata from the Edge Device
    and push it to a Celery task for database persistence.
    It does not broadcast any data.
    """

    async def connect(self):
        # Add authentication logic for the Edge Device here if needed
        await self.accept()
        logger.info(f"Persistence client connected. Channel: {self.channel_name}")

    async def disconnect(self, close_code):
        logger.info(f"Persistence client disconnected. Code: {close_code}")

    async def receive_json(self, content):
        """
        Receives metadata, validates it, and dispatches it to a Celery worker.
        """
        try:
            # 1. Validate data using the FrameData Pydantic schema
            validated_data = FrameData.model_validate(content)
            logger.debug("Received valid metadata for persistence.")

            # 2. If data is valid and meant to be saved, push to Celery
            if validated_data.save_to_db:
                # Use model_dump() to ensure it's a serializable dictionary
                save_frame_task.delay(validated_data.model_dump())
                logger.info("Dispatched metadata to Celery for saving.")

        except ValidationError as e:
            # Log Pydantic validation errors
            logger.error(f"Persistence Validation Error: {e.errors()}")
            # Optionally, send an error back to the client for debugging
            await self.send_json({
                "error": {
                    "code": "BAD_REQUEST",
                    "message": "Invalid data format.",
                    "details": e.errors()
                }
            })
        except Exception as e:
            # Log other unexpected errors
            logger.error(f"An unexpected error occurred in PersistenceConsumer: {str(e)}")
            await self.send_json({
                "error": {
                    "code": "SERVER_ERROR",
                    "message": "An internal error occurred."
                }
            })
