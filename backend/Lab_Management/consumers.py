import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from datetime import datetime
from .models import FrameData, ObjectDetection
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
            data = json.loads(text_data)
            
            # 1. PUSH REALTIME: Immediately broadcast to Frontend (via Group)
            # No need to wait for DB save, reducing display latency
            if self.channel_layer:
                await self.channel_layer.group_send(
                    MONITOR_GROUP_NAME,
                    {
                        "type": "broadcast_frame", # Handler name in FrontendConsumer
                        "message": data
                    }
                )

            # 2. SAVE TO DATABASE: Check save_to_db flag
            if data.get('save_to_db', False):
                await self.save_frame_data(data)

        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")

    @database_sync_to_async
    def save_frame_data(self, data):
        try:
            # Parse timestamp
            timestamp_str = data.get('timestamp')
            if timestamp_str:
                try:
                    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                except ValueError:
                    timestamp = datetime.utcnow()
            else:
                timestamp = datetime.utcnow()

            # Create FrameData instance
            frame = FrameData.objects.create(
                frame_id=data.get('frame_id'),
                timestamp=timestamp,
                count_in=data.get('count_in', 0),
                count_out=data.get('count_out', 0)
            )

            # Create ObjectDetection instances
            objects_data = data.get('objects', [])
            object_instances = []
            for obj in objects_data:
                object_instances.append(ObjectDetection(
                    frame_data=frame,
                    track_id=obj.get('track_id'),
                    class_name=obj.get('class', 'person'), # Handle alias
                    conf=obj.get('conf'),
                    bbox=obj.get('bbox'),
                    coordinates=obj.get('coordinates'),
                    height=obj.get('height'),
                    width=obj.get('width')
                ))
            
            if object_instances:
                ObjectDetection.objects.bulk_create(object_instances)
                
            logger.info(f"Saved frame {frame.frame_id} with {len(object_instances)} objects")

        except Exception as e:
            logger.error(f"Error saving to database: {str(e)}")
