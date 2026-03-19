import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from pydantic import ValidationError
import logging

from ..schemas import MappingRequest
from ..models import Calibration, Correspondence

logger = logging.getLogger(__name__)

MAPPING_GROUP_NAME = "mapping_settings"

class MappingConsumer(AsyncJsonWebsocketConsumer):
    """
    This consumer handles WebSocket connections for calibration mapping.
    - Frontend connects to send mapping data.
    - Edge Devices connect to listen for mapping updates.
    """

    async def connect(self):
        """
        Adds the connection to a group so it can receive broadcasts.
        """
        await self.channel_layer.group_add(MAPPING_GROUP_NAME, self.channel_name)
        await self.accept()
        logger.info(f"Client connected to mapping WebSocket. Channel: {self.channel_name}")

    async def disconnect(self, close_code):
        """
        Removes the connection from the group.
        """
        await self.channel_layer.group_discard(MAPPING_GROUP_NAME, self.channel_name)
        logger.info(f"Client disconnected from mapping WebSocket. Code: {close_code}")

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
        """
        Receives data from a client (expected from Frontend).
        It validates the data, saves it to the database, and then broadcasts
        it to all clients in the group (Edge Devices).
        """
        try:
            # 1. Validate data using Pydantic schema
            mapping_data = MappingRequest.model_validate(content)
            logger.info("Received valid mapping data from a client.")

            # 2. Save the new calibration data to the database
            await self.save_calibration_data(mapping_data)
            logger.info("Successfully saved new calibration data to the database.")

            # 3. Send a success confirmation back to the original sender
            await self.send_json({
                "status": "ok",
                "message": "Calibration data received and saved successfully."
            })

            # 4. Broadcast the validated data to the entire group
            await self.channel_layer.group_send(
                MAPPING_GROUP_NAME,
                {
                    "type": "broadcast_mapping",
                    "message": mapping_data.model_dump()
                }
            )
            logger.info("Broadcasted new mapping data to all clients in the group.")

        except ValidationError as e:
            # Handle Pydantic validation errors
            logger.error(f"Validation Error: {e.errors()}")
            await self.send_json({
                "error": {
                    "code": "BAD_REQUEST",
                    "message": "Invalid data format.",
                    "details": e.errors()
                }
            })
        except Exception as e:
            # Handle other unexpected errors
            logger.error(f"An unexpected error occurred: {str(e)}")
            await self.send_json({
                "error": {
                    "code": "SERVER_ERROR",
                    "message": "An internal error occurred."
                }
            })

    async def broadcast_mapping(self, event):
        """
        Handler for the broadcast message. Sends the mapping data
        down to the client (Edge Devices).
        """
        message = event['message']
        await self.send_json(message)
        logger.info(f"Sent mapping broadcast to client {self.channel_name}")

    @database_sync_to_async
    def save_calibration_data(self, mapping_data: MappingRequest):
        """
        Saves the calibration data to the database.
        This runs in a separate thread to avoid blocking the async event loop.
        We create a new Calibration entry and its associated Correspondence objects.
        The active calibration is always the latest one in the database.
        """
        # Create a new parent calibration object
        new_calibration = Calibration.objects.create(
            image_width=mapping_data.image_size.width,
            image_height=mapping_data.image_size.height,
            map_width=mapping_data.map_size.width,
            map_height=mapping_data.map_size.height
        )

        # Create Correspondence objects for it
        corr_to_create = []
        for corr_data in mapping_data.correspondences:
            corr_to_create.append(
                Correspondence(
                    calibration=new_calibration,
                    label=corr_data.label,
                    camera=corr_data.camera,
                    map=corr_data.map
                )
            )

        Correspondence.objects.bulk_create(corr_to_create)
