import json
from channels.generic.websocket import AsyncWebsocketConsumer
from pydantic import ValidationError
from .schemas import FrameData as FrameDataSchema
from .tasks import save_frame_task
import logging

logger = logging.getLogger(__name__)

# Shared Group name for Frontend to join and Edge to broadcast to
MONITOR_GROUP_NAME = "lab_monitor"


class FrontendConsumer(AsyncWebsocketConsumer):
    """
    Consumer for Frontend (Next.js/React) to receive realtime data.
    """

    async def connect(self):
        # When Frontend connects, add to "lab_monitor" group
        await self.channel_layer.group_add(
            MONITOR_GROUP_NAME,
            self.channel_name
        )
        await self.accept()
        logger.info("Frontend connected and joined group")

    async def disconnect(self, close_code):
        # When disconnected, remove from group
        await self.channel_layer.group_discard(
            MONITOR_GROUP_NAME,
            self.channel_name
        )
        logger.info("Frontend disconnected")

    # This handler is called when a message is sent to the Group with type="broadcast_frame"
    async def broadcast_frame(self, event):
        message = event['message']
        # Send data down to Frontend WebSocket
        await self.send(text_data=json.dumps(message))


class EdgeDeviceConsumer(AsyncWebsocketConsumer):
    """
    Consumer for Edge Device to send data upstream.
    Decouples realtime broadcasting from database saving using Celery.
    """

    async def connect(self):
        # Authenticate edge device here if needed
        await self.accept()
        logger.info("Edge device connected")

    async def disconnect(self, close_code):
        logger.info(f"Edge device disconnected with code {close_code}")

    async def receive(self, text_data):
        try:
            raw_data = json.loads(text_data)

            # --- PYDANTIC VALIDATION ---
            try:
                validated_frame = FrameDataSchema.model_validate(raw_data)
                data = validated_frame.model_dump(mode='json', by_alias=True)
            except ValidationError as e:
                logger.error(f"Validation Error: {e.json()}")
                return

            # 1. Separate image from metadata
            frame_image_base64 = data.pop('frame_image', None)

            # 2. PUSH TO CELERY (Metadata only)
            if validated_frame.save_to_db:
                # Call Celery task asynchronously
                save_frame_task.delay(data)

            # 3. PUSH REALTIME (With image)
            if frame_image_base64:
                data['frame_image'] = frame_image_base64 # Add image back for frontend
            
            if self.channel_layer:
                await self.channel_layer.group_send(
                    MONITOR_GROUP_NAME,
                    {
                        "type": "broadcast_frame",
                        "message": data
                    }
                )

        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
