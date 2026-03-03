import json
import time
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from datetime import datetime
from pydantic import ValidationError
from django.db import transaction
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
    Implements Smart Sampling: Saves Max/Min occupancy every 5 mins + All Alerts.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # State variables for 5-minute window sampling
        self.WINDOW_DURATION = 300  # 5 minutes in seconds
        self.window_start_time = time.time()
        self.max_occupancy_frame = None
        self.min_occupancy_frame = None
        self.max_occupancy_count = -1
        self.min_occupancy_count = float('inf')

    async def connect(self):
        # Authenticate edge device here if needed
        await self.accept()
        logger.info("Edge device connected")

    async def disconnect(self, close_code):
        # Flush any remaining frames before disconnecting
        await self.flush_window_frames()
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
                return

            # 1. PUSH REALTIME: Immediately broadcast to Frontend (via Group)
            if self.channel_layer:
                await self.channel_layer.group_send(
                    MONITOR_GROUP_NAME,
                    {
                        "type": "broadcast_frame",  # Handler name in FrontendConsumer
                        "message": data
                    }
                )

            # 2. SAVE TO DATABASE (OPTIMIZED)
            if validated_frame.save_to_db:
                # A. Always save ALERT frames immediately
                if validated_frame.alert != 'none':
                    await self.save_frame_data(validated_frame, reason=f"Alert ({validated_frame.alert})")
                
                # B. Process for 5-minute window sampling (Max/Min)
                await self.process_frame_for_window(validated_frame)

        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")

    async def process_frame_for_window(self, frame: FrameDataSchema):
        current_time = time.time()
        
        # Check if the 5-minute window has passed
        if current_time - self.window_start_time >= self.WINDOW_DURATION:
            await self.flush_window_frames()
        
        # Update max/min occupancy frames within the current window
        current_occupancy = len(frame.objects)
        
        # Update Max
        if current_occupancy > self.max_occupancy_count:
            self.max_occupancy_count = current_occupancy
            self.max_occupancy_frame = frame
            
        # Update Min
        if current_occupancy < self.min_occupancy_count:
            self.min_occupancy_count = current_occupancy
            self.min_occupancy_frame = frame

    async def flush_window_frames(self):
        """Saves the max and min frames of the completed window to the DB."""
        saved_ids = set()

        # Save Max Frame
        if self.max_occupancy_frame:
            await self.save_frame_data(self.max_occupancy_frame, reason=f"Max Occupancy ({self.max_occupancy_count})")
            # We don't have frame_id anymore, so we can't use it to avoid duplicates.
            # This is a minor issue, as max/min are unlikely to be the same frame.
        
        # Save Min Frame
        if self.min_occupancy_frame:
            # A simple check to see if the frames are identical might be enough
            if self.min_occupancy_frame != self.max_occupancy_frame:
                await self.save_frame_data(self.min_occupancy_frame, reason=f"Min Occupancy ({self.min_occupancy_count})")

        # Reset for the new window
        self.window_start_time = time.time()
        self.max_occupancy_frame = None
        self.min_occupancy_frame = None
        self.max_occupancy_count = -1
        self.min_occupancy_count = float('inf')

    @database_sync_to_async
    def save_frame_data(self, frame_schema: FrameDataSchema, reason: str = "Unspecified"):
        try:
            with transaction.atomic():
                # Create FrameData instance (Django Model)
                frame = FrameData.objects.create(
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
                        bbox=obj.bbox,
                        coordinates_2D=obj.coordinates_2D
                    ))

                if object_instances:
                    ObjectDetection.objects.bulk_create(object_instances)

                logger.info(f"Saved frame at {frame.timestamp} (Reason: {reason})")

        except Exception as e:
            logger.error(f"Error saving to database: {str(e)}")
