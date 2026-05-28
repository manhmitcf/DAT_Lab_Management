import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from pydantic import ValidationError
import logging

from ..schemas import CountingRequest
from ..models import CountingSetting

logger = logging.getLogger(__name__)

COUNTING_GROUP_NAME = "counting_settings"

class CountingConsumer(AsyncJsonWebsocketConsumer):
    """
    This consumer handles WebSocket connections for counting line settings.
    - Frontend connects to send counting config.
    - Edge Devices connect to listen for counting updates.
    """

    async def connect(self):
        await self.channel_layer.group_add(COUNTING_GROUP_NAME, self.channel_name)
        await self.accept()
        logger.info(f"Client connected to counting WebSocket. Channel: {self.channel_name}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(COUNTING_GROUP_NAME, self.channel_name)
        logger.info(f"Client disconnected from counting WebSocket. Code: {close_code}")

    async def receive(self, text_data=None, bytes_data=None, **kwargs):
        if text_data:
            try:
                data = await self.decode_json(text_data)
            except json.JSONDecodeError:
                await self.send_json({
                    "error": {
                        "code": "INVALID_JSON",
                        "message": "Malformed JSON data format."
                    }
                })
                return
            await self.receive_json(data, **kwargs)

    async def receive_json(self, content):
        try:
            # 1. Validate data using Pydantic schema
            counting_data = CountingRequest.model_validate(content)
            logger.info("Received valid counting setting from a client.")

            # 2. Save the new counting data to the database
            await self.save_counting_data(counting_data)
            logger.info("Successfully saved new counting setting to the database.")

            # 3. Send a success confirmation back to the original sender
            await self.send_json({
                "status": "ok",
                "message": "Counting setting received and saved successfully."
            })

            # 4. Broadcast the validated data to the entire group
            await self.channel_layer.group_send(
                COUNTING_GROUP_NAME,
                {
                    "type": "broadcast_counting",
                    "message": counting_data.model_dump()
                }
            )
            logger.info("Broadcasted new counting setting to all clients in the group.")

        except ValidationError as e:
            logger.error(f"Validation Error: {e.errors()}")
            await self.send_json({
                "error": {
                    "code": "BAD_REQUEST",
                    "message": "Invalid data format.",
                    "details": e.errors()
                }
            })
        except Exception as e:
            logger.error(f"An unexpected error occurred: {str(e)}")
            await self.send_json({
                "error": {
                    "code": "SERVER_ERROR",
                    "message": "An internal error occurred."
                }
            })

    async def broadcast_counting(self, event):
        message = event['message']
        await self.send_json(message)
        logger.info(f"Sent counting broadcast to client {self.channel_name}")

    @database_sync_to_async
    def save_counting_data(self, counting_data: CountingRequest):
        """
        Saves the counting configuration to the database.
        """
        CountingSetting.objects.create(
            line_start=counting_data.line_start,
            line_end=counting_data.line_end,
            inside_point=counting_data.inside_point,
            crossing_margin=counting_data.crossing_margin,
            frame_height=counting_data.frame_height,
            frame_width=counting_data.frame_width
        )
