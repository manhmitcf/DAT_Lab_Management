"""
Aura Analytics - Main Entry Point
High-performance AI detection and tracking pipeline for NVIDIA Jetson.
"""

import os
import sys
import signal
from typing import Tuple
from loguru import logger

# Load environment logic
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from core.config import ConfigManager
from services.analytics.tracking_service import TrackingService
from services.analytics.counting_service import CountingService
from services.analytics.mapping_service import MappingService
from services.gateway.backend_gateway import ResultPublisher, SettingsSubscriber
from services.pipeline.manager import PipelineManager
from services.pipeline.probe import AnalyticsProbe


class AuraAnalyticsApp:
    """
    Main Application class to coordinate services and the DeepStream pipeline.
    """

    def __init__(self):
        self.pipeline_manager = PipelineManager()
        self.settings_sub = None
        self.services = {}
        
        # Configuration paths
        self.config_paths = {
            "tracking": "config/tracking_config.json",
            "counting": "config/counting_config.json",
            "mapping": "config/mapping_config.json",
            "infer": os.getenv("CONFIG_INFER", "config/config_infer.txt")
        }

    def _setup_services(self):
        """Initialize all business logic services."""
        logger.info("[App] Initializing core services...")
        
        # 1. Load Configs via ConfigManager
        tracking_cfg = ConfigManager.get_ocsort_config(self.config_paths["tracking"])
        counting_cfg = ConfigManager.get_counting_config(self.config_paths["counting"])
        mapping_cfg = ConfigManager.get_mapping_config(self.config_paths["mapping"])

        # 2. Instantiate Services
        # Default 1080p, will sync with actual source resolution in probe
        init_size = (1920, 1080)
        
        self.services["tracking"] = TrackingService(config=tracking_cfg)
        self.services["counting"] = CountingService(counting_config=counting_cfg, current_frame_size=init_size)
        self.services["mapping"] = MappingService(config=mapping_cfg)
        
        self.services["publisher"] = ResultPublisher(
            endpoint=os.getenv("RESULTS_WS_URL"),
            bearer_token=os.getenv("API_BEARER_TOKEN")
        )
        
        logger.success("[App] Services initialized.")

    def _setup_pipeline(self):
        """Assemble the GStreamer pipeline and attach the analytics probe."""
        video_source = os.getenv("VIDEO_SOURCE", "./videos/demo.mp4")
        
        # 1. Initialize Probe
        probe = AnalyticsProbe(
            tracking_service=self.services["tracking"],
            counting_service=self.services["counting"],
            mapping_service=self.services["mapping"],
            publisher=self.services["publisher"],
            warning_threshold=int(os.getenv("ALERT_WARNING_THRESH", 25)),
            critical_threshold=int(os.getenv("ALERT_CRITICAL_THRESH", 50))
        )

        # 2. Build Pipeline
        try:
            self.pipeline_manager.build_pipeline(
                source_uri=video_source,
                config_infer=self.config_paths["infer"]
            )
            self.pipeline_manager.attach_probe(probe)
        except Exception as e:
            logger.critical(f"[App] Failed to construct pipeline: {e}")
            raise

    def _setup_hot_reload(self):
        """Configure SettingsSubscriber for live updates from backend."""
        logger.info("[App] Starting SettingsSubscriber...")
        
        def on_mapping_update(data):
            logger.info("[App:HotReload] Applying new Mapping config...")
            try:
                # Basic normalization of backend data
                img_size = data.get("image_size", {})
                m_size = data.get("map_size", {})
                
                self.services["mapping"].update_mapping(
                    camera_points=[(float(c[0]), float(c[1])) for c in data.get("correspondences_camera", [])],
                    map_points=[(float(m[0]), float(m[1])) for m in data.get("correspondences_map", [])],
                    camera_size=(int(img_size.get("width", 1920)), int(img_size.get("height", 1080))),
                    map_size=(int(m_size.get("width", 1000)), int(m_size.get("height", 1000)))
                )
                logger.success("[App:HotReload] Mapping updated.")
            except Exception as e:
                logger.error(f"[App:HotReload] Mapping update failed: {e}")

        def on_counting_update(data):
            logger.info("[App:HotReload] Applying new Counting config...")
            try:
                self.services["counting"].update_config(
                    line_start=tuple(data.get("line_start")),
                    line_end=tuple(data.get("line_end")),
                    inside_point=tuple(data.get("inside_point")),
                    crossing_margin=data.get("crossing_margin", 10.0),
                    source_frame_size=(data.get("frame_width", 1920), data.get("frame_height", 1080)),
                    current_frame_size=(1920, 1080) # Sync with actual if possible
                )
                logger.success("[App:HotReload] Counting updated.")
            except Exception as e:
                logger.error(f"[App:HotReload] Counting update failed: {e}")

        self.settings_sub = SettingsSubscriber(
            on_mapping_update=on_mapping_update,
            on_counting_update=on_counting_update
        )
        self.settings_sub.start()

    def run(self):
        """Main execution entry point."""
        logger.info("=== Starting Aura Analytics Application ===")
        
        try:
            self._setup_services()
            self._setup_pipeline()
            self._setup_hot_reload()
            
            # Start the GStreamer Main Loop
            self.pipeline_manager.run()
            
        except KeyboardInterrupt:
            logger.warning("[App] Implementation interrupted by user (SIGINT).")
        except Exception as e:
            logger.exception(f"[App] Fatal error during execution: {e}")
        finally:
            self.shutdown()

    def shutdown(self):
        """Graceful resource cleanup."""
        logger.info("[App] Shutdown sequence initiated...")
        
        if self.settings_sub:
            self.settings_sub.stop()
            
        self.pipeline_manager.stop()
        
        logger.success("=== Aura Analytics Shutdown Complete ===")


def signal_handler(sig, frame):
    """Bridge OS signals to the Application shutdown."""
    logger.warning(f"[System] Signal {sig} received.")
    sys.exit(0)


if __name__ == "__main__":
    # Register OS signals for Docker/Process management
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    app = AuraAnalyticsApp()
    app.run()
