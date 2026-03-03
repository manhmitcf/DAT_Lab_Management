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
    Implements Smart Sampling Strategy:
    1. Alert (Warning/Critical) -> Save Immediately
    2. Sudden Change (>5 people) -> Save Immediately
    3. Start Frame (Every 1 min) -> Save Immediately
    4. Max/Min Occupancy (Every 5 mins) -> Save at end of window
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # --- Sampling Configuration ---
        self.WINDOW_DURATION_5M = 300  # 5 minutes
        self.WINDOW_DURATION_1M = 60   # 1 minute
        self.SUDDEN_CHANGE_THRESHOLD = 5 # People count difference
        
        # --- State Variables ---
        self.window_start_5m = time.time()
        self.last_saved_1m_time = 0
        self.last_saved_occupancy = 0 # To track sudden changes
        
        # Max/Min tracking for 5-min window
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
                data = validated_frame.model_dump(mode='json', by_alias=True)
            except ValidationError as e:
                logger.error(f"Validation Error: {e.json()}")
                return

            # 1. PUSH REALTIME: Immediately broadcast to Frontend (via Group)
            if self.channel_layer:
                await self.channel_layer.group_send(
                    MONITOR_GROUP_NAME,
                    {
                        "type": "broadcast_frame",
                        "message": data
                    }
                )

            # 2. SAVE TO DATABASE (SMART SAMPLING)
            if validated_frame.save_to_db:
                await self.process_smart_sampling(validated_frame)

        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")

    async def process_smart_sampling(self, frame: FrameDataSchema):
        current_time = time.time()
        current_occupancy = len(frame.objects)
        should_save_now = False
        save_reason = ""

        # A. Priority 1: Critical/Warning Alert
        if frame.alert in ['warning', 'critical']:
            should_save_now = True
            save_reason = f"Alert ({frame.alert})"

        # B. Priority 2: Sudden Change
        # Compare with the last saved occupancy (to avoid noise)
        elif abs(current_occupancy - self.last_saved_occupancy) > self.SUDDEN_CHANGE_THRESHOLD:
            should_save_now = True
            save_reason = f"Sudden Change ({self.last_saved_occupancy} -> {current_occupancy})"

        # C. Priority 3: Start Frame (Every 1 minute)
        elif current_time - self.last_saved_1m_time >= self.WINDOW_DURATION_1M:
            should_save_now = True
            save_reason = "Start Frame (1m)"
            self.last_saved_1m_time = current_time

        # --- Execute Save if needed ---
        if should_save_now:
            await self.save_frame_data(frame, reason=save_reason)
            self.last_saved_occupancy = current_occupancy

        # D. Priority 4: Max/Min Tracking (Every 5 minutes)
        # Always update tracking state, regardless of whether we saved above
        
        # Check if 5-min window passed
        if current_time - self.window_start_5m >= self.WINDOW_DURATION_5M:
            await self.flush_window_frames()
        
        # Update Max
        if current_occupancy > self.max_occupancy_count:
            self.max_occupancy_count = current_occupancy
            self.max_occupancy_frame = frame
            
        # Update Min
        if current_occupancy < self.min_occupancy_count:
            self.min_occupancy_count = current_occupancy
            self.min_occupancy_frame = frame

    async def flush_window_frames(self):
        """Saves the max and min frames of the completed 5-min window."""
        # Save Max Frame
        if self.max_occupancy_frame:
            await self.save_frame_data(self.max_occupancy_frame, reason=f"Max Occupancy ({self.max_occupancy_count})")
        
        # Save Min Frame (only if different from Max)
        if self.min_occupancy_frame:
            # Simple object comparison might not work if timestamps differ slightly, 
            # but here we care about the content. 
            # If occupancy is different, definitely save.
            if self.min_occupancy_count != self.max_occupancy_count:
                await self.save_frame_data(self.min_occupancy_frame, reason=f"Min Occupancy ({self.min_occupancy_count})")

        # Reset for the new window
        self.window_start_5m = time.time()
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
