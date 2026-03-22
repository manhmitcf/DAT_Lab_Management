import os
import time
import queue
import threading
from loguru import logger

from services.backend_gateway import ResultPublisher, SettingsSubscriber

class ServiceManager:
    """
    Manages background services for publishing results and subscribing to settings.
    """
    def __init__(self, app_instance):
        self.app = app_instance
        self.result_publisher = ResultPublisher()
        self.settings_subscriber = SettingsSubscriber(
            on_mapping_update=self.app.handle_mapping_update,
            on_counting_update=self.app.handle_counting_update
        )
        self.publisher_thread = None

    def start_services(self):
        """Starts the result publisher and settings subscriber threads."""
        logger.info("[SERVICES] Starting background services...")
        
        self.publisher_thread = threading.Thread(target=self._background_publisher_task, daemon=True)
        self.publisher_thread.start()
        
        self.settings_subscriber.start()
        logger.info("[SERVICES] WebSocket Settings Subscriber started.")
        logger.info(f"[PIPELINE] Configuring WebRTC UDP Sink → {self.app.janus_ip}:{self.app.janus_port}")


    def stop_services(self):
        """Stops all running background services gracefully."""
        logger.info("[SERVICES] Stopping background services...")
        self.settings_subscriber.stop()
        
        # Signal the publisher thread to stop
        self.app.frame_data_queue.put(None)
        if self.publisher_thread:
            self.publisher_thread.join(timeout=5.0)
        
        logger.info("[SERVICES] All services stopped.")

    def _background_publisher_task(self):
        """Background thread task to publish frame data."""
        logger.info("[Publisher] Background publisher thread started. Waiting for frames...")
        frames_sent = 0
        last_log_time = time.time()
        
        while True:
            try:
                frame_data = self.app.frame_data_queue.get(timeout=10.0)
                if frame_data is None:
                    logger.info("[Publisher] Received shutdown signal. Stopping.")
                    break
                
                self.result_publisher.send_frame(frame_data)
                frames_sent += 1

                if frames_sent == 1:
                    logger.success(f"[Publisher] First frame published successfully to {os.getenv('RESULTS_WS_URL')}")
                elif frames_sent % 300 == 0:
                    logger.debug(f"[Publisher] {frames_sent} frames published so far.")

            except queue.Empty:
                if time.time() - last_log_time > 30:
                    logger.warning("[Publisher] No data received from pipeline for 30 seconds. Is camera streaming?")
                    last_log_time = time.time()
            except Exception as e:
                logger.error(f"[Publisher] Error publishing frame data: {e}")
