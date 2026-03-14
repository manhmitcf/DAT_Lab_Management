import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from pydantic import ValidationError
import logging

from ..schemas import FrameData
from ..tasks import save_frame_task

logger = logging.getLogger(__name__)

# A shared group name for the Frontend to join and the Edge Device to broadcast to
METADATA_GROUP_NAME = "metadata_broadcast"

class PersistenceConsumer(AsyncJsonWebsocketConsumer):
    """
    This consumer serves two purposes:
    1. Receives JSON from the Edge Device and broadcasts it to all listening Frontends.
    2. Dispatches the same JSON to a Celery task for database persistence.
    """

    async def connect(self):
        """
        When a client (Edge or Frontend) connects, add them to the broadcast group.
        """
        await self.channel_layer.group_add(
            METADATA_GROUP_NAME,
            self.channel_name
        )
        await self.accept()
        logger.info(f"Client connected to metadata stream. Channel: {self.channel_name}")

    async def disconnect(self, close_code):
        """
        When a client disconnects, remove them from the group.
        """
        await self.channel_layer.group_discard(
            METADATA_GROUP_NAME,
            self.channel_name
        )
        logger.info(f"Client disconnected from metadata stream. Code: {close_code}")

    async def receive_json(self, content):
        """
        Receives metadata from the Edge Device, validates it, broadcasts it, and dispatches it for persistence.
        """
        try:
            # 1. Validate data using Pydantic
            validated_data = FrameData.model_validate(content)
            data_dict = validated_data.model_dump(mode='json', by_alias=True)
            
            # 2. BROADCAST: Send the JSON payload to everyone in the group (including Frontends)
            await self.channel_layer.group_send(
                METADATA_GROUP_NAME,
                {
                    "type": "broadcast_metadata",
                    "message": data_dict,
                    "sender_channel_name": self.channel_name
                }
            )

            # 3. PERSISTENCE: Push the data to Celery for asynchronous database saving
            if validated_data.save_to_db:
                save_frame_task.delay(data_dict)
                logger.debug("Dispatched metadata to Celery for saving.")

        except ValidationError as e:
            logger.error(f"Persistence Validation Error: {e.errors()}")
            await self.send_json({
                "error": {
                    "code": "BAD_REQUEST",
                    "message": "Invalid data format.",
                    "details": e.errors()
                }
            })
        except Exception as e:
            logger.error(f"An unexpected error occurred in PersistenceConsumer: {str(e)}")

    async def broadcast_metadata(self, event):
        """
        Event handler for the broadcast. This method is called for EACH client in the group.
        Its job is to take the message from the group and push it down the client's WebSocket.
        """
        message = event['message']
        
        # Optional: Don't send the message back to the original sender (the Edge Device)
        # If you want the Edge Device to also receive the message for confirmation, remove this if-block.
        if self.channel_name != event.get('sender_channel_name'):
            await self.send_json(message)
