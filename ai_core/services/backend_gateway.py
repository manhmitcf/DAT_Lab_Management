import os
import json
import time
import threading
from typing import Callable, Optional, Dict, Any

import websocket
from loguru import logger

from schemas.schemas import FrameData
from config.data_config import MappingConfig, CountingConfig


# ========================
# RESULT PUBLISHER
# ========================
class ResultPublisher:
    def __init__(
        self,
        endpoint: Optional[str] = None,
        bearer_token: Optional[str] = None,
        reconnect: bool = True,
    ) -> None:
        self.endpoint = endpoint or os.getenv("RESULTS_WS_URL")
        self.bearer_token = bearer_token or os.getenv("API_BEARER_TOKEN")
        self.reconnect = reconnect
        self.ws: Optional[websocket.WebSocket] = None

    def _connect(self) -> None:
        if not self.endpoint:
            raise ValueError("RESULTS_WS_URL is not configured")

        headers = []
        if self.bearer_token:
            headers.append(f"Authorization: Bearer {self.bearer_token}")

        logger.info(f"[Publisher] Connecting → {self.endpoint}")
        self.ws = websocket.create_connection(self.endpoint, header=headers)
        logger.success(f"[Publisher] Connected successfully to {self.endpoint}")

    def send_frame(self, frame_data: FrameData) -> None:
        payload = frame_data.model_dump_json()

        if self.ws is None:
            self._connect()

        try:
            self.ws.send(payload)
        except Exception as e:
            logger.warning(f"[Publisher] Send failed: {e}")

            if self.reconnect:
                logger.info("[Publisher] Reconnecting...")
                self._connect()
                self.ws.send(payload)
            else:
                raise

    def close(self) -> None:
        if self.ws:
            self.ws.close()
            self.ws = None
            logger.info("[Publisher] Closed connection")


# ========================
# SETTINGS SUBSCRIBER
# ========================
class SettingsSubscriber:
    
    
    def __init__(
        self,
        mapping_ws_url: Optional[str] = None,
        counting_ws_url: Optional[str] = None,
        bearer_token: Optional[str] = None,
        on_mapping_update: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_counting_update: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        self.mapping_url = mapping_ws_url or os.getenv("MAPPING_SETTINGS_WS_URL")
        self.counting_url = counting_ws_url or os.getenv("COUNTING_SETTINGS_WS_URL")
        self.bearer_token = bearer_token or os.getenv("API_BEARER_TOKEN")
        
        self.on_mapping_update = on_mapping_update
        self.on_counting_update = on_counting_update

        self.mapping_ws: Optional[websocket.WebSocketApp] = None
        self.counting_ws: Optional[websocket.WebSocketApp] = None
        self._stop_event = threading.Event()

    def _get_headers(self) -> list:
        headers = []
        if self.bearer_token:
            headers.append(f"Authorization: Bearer {self.bearer_token}")
        return headers

    def _on_mapping_message(self, ws, message):
        logger.info("[SettingsSubscriber] Received MAPPING update from backend")
        try:
            data = json.loads(message)
            if self.on_mapping_update:
                self.on_mapping_update(data)
            else:
                logger.info(f"[SettingsSubscriber] MAPPING Data: {data}")
        except Exception as e:
            logger.error(f"[SettingsSubscriber] Failed to parse mapping message: {e}")

    def _on_counting_message(self, ws, message):
        logger.info("[SettingsSubscriber] Received COUNTING update from backend")
        try:
            data = json.loads(message)
            if self.on_counting_update:
                self.on_counting_update(data)
            else:
                logger.info(f"[SettingsSubscriber] COUNTING Data: {data}")
        except Exception as e:
            logger.error(f"[SettingsSubscriber] Failed to parse counting message: {e}")

    def _on_error(self, ws, error):
        logger.error(f"[SettingsSubscriber] WebSocket error: {error}")

    def _on_close(self, ws, close_status_code, close_msg):
        logger.info(f"[SettingsSubscriber] Connection closed: {close_status_code} - {close_msg}")

    def _run_mapping_ws(self):
        while not self._stop_event.is_set():
            if not self.mapping_url:
                break
            logger.info(f"[SettingsSubscriber] Connecting to Mapping WS: {self.mapping_url}")
            self.mapping_ws = websocket.WebSocketApp(
                self.mapping_url,
                header=self._get_headers(),
                on_message=self._on_mapping_message,
                on_error=self._on_error,
                on_close=self._on_close
            )
            self.mapping_ws.run_forever(ping_interval=30, ping_timeout=10)
            
            if not self._stop_event.is_set():
                logger.info("[SettingsSubscriber] Reconnecting Mapping WS in 3 seconds...")
                time.sleep(3)

    def _run_counting_ws(self):
        while not self._stop_event.is_set():
            if not self.counting_url:
                break
            logger.info(f"[SettingsSubscriber] Connecting to Counting WS: {self.counting_url}")
            self.counting_ws = websocket.WebSocketApp(
                self.counting_url,
                header=self._get_headers(),
                on_message=self._on_counting_message,
                on_error=self._on_error,
                on_close=self._on_close
            )
            self.counting_ws.run_forever(ping_interval=30, ping_timeout=10)
            
            if not self._stop_event.is_set():
                logger.info("[SettingsSubscriber] Reconnecting Counting WS in 3 seconds...")
                time.sleep(3)

    def start(self):
        """Khởi chạy các luồng lắng nghe WebSocket."""
        self._stop_event.clear()
        if self.mapping_url:
            threading.Thread(target=self._run_mapping_ws, daemon=True).start()
        if self.counting_url:
            threading.Thread(target=self._run_counting_ws, daemon=True).start()

    def stop(self):
        """Dừng tất cả các luồng lắng nghe WebSocket."""
        self._stop_event.set()
        if self.mapping_ws:
            self.mapping_ws.close()
        if self.counting_ws:
            self.counting_ws.close()
        logger.info("[SettingsSubscriber] Stopped settings subscribers")
