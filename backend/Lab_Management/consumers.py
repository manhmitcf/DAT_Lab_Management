import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from datetime import datetime
from pydantic import ValidationError
from .models import FrameData, ObjectDetection
from .schemas import FrameData as FrameDataSchema
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
                # Validate incoming JSON against the schema
                validated_frame = FrameDataSchema.model_validate(raw_data)
                
                # Convert back to dict for processing (using by_alias to keep 'class' field if needed)
                data = validated_frame.model_dump(mode='json', by_alias=True)
                
            except ValidationError as e:
                logger.error(f"Validation Error: {e.json()}")
                # Optionally send error back to Edge Device
                # await self.send(text_data=json.dumps({"error": "Invalid Data", "details": e.errors()}))
                return

            # 1. PUSH REALTIME: Immediately broadcast to Frontend (via Group)
            if self.channel_layer:
                await self.channel_layer.group_send(
                    MONITOR_GROUP_NAME,
                    {
                        "type": "broadcast_frame", # Handler name in FrontendConsumer
                        "message": data
                    }
                )

            # 2. SAVE TO DATABASE: Check save_to_db flag
            if validated_frame.save_to_db:
                await self.save_frame_data(validated_frame)

        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")

    @database_sync_to_async
    def save_frame_data(self, frame_schema: FrameDataSchema):
        try:
            # Create FrameData instance (Django Model)
            frame = FrameData.objects.create(
                frame_id=frame_schema.frame_id,
                timestamp=frame_schema.timestamp,
                count_in=frame_schema.count_in,
                count_out=frame_schema.count_out,
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
                    class_name=obj.class_name, 
                    conf=obj.conf,
                    bbox=obj.bbox,
                    coordinates_2D=obj.coordinates_2D
                ))
            
            if object_instances:
                ObjectDetection.objects.bulk_create(object_instances)
                
            logger.info(f"Saved frame {frame.frame_id} with {len(object_instances)} objects")

        except Exception as e:
            logger.error(f"Error saving to database: {str(e)}")
