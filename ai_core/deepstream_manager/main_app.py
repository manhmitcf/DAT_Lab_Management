import os
import queue
from loguru import logger

from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

from services.cpp_probe_service import cpp_probe_service
from config.data_config import MappingConfig, CountingConfig
from pipeline.model_converter import check_and_convert_models
from pipeline.osd_probe import OSDProbeHandler

from .diagnostics import Diagnostics
from .config_manager import ConfigManager
from .pipeline_manager import PipelineManager
from .service_manager import ServiceManager

class DeepStreamApp:
    """
    The main application orchestrator.
    Initializes and coordinates all the managers (Diagnostics, Config, Pipeline, Services).
    """
    def __init__(self):
        # Core application state
        self.frame_data_queue = queue.Queue(maxsize=100)

        # Environment and Config dependent properties
        self.janus_ip = os.getenv("JANUS_SERVER_IP", "127.0.0.1")
        self.janus_port = int(os.getenv("JANUS_UDP_PORT", "8000"))
        self.video_source = os.getenv("INPUT_VIDEO_SOURCE", "/dev/video0")
        self.pgie_config_path = os.getenv("PGIE_CONFIG_PATH", "deploy/DeepStream/config_infer_primary_yolox.txt")

        # Core components
        self.mapping_config = MappingConfig("config/mapping_config.json")
        self.counting_config = CountingConfig(json_path="config/counting_config.json")
        self.osd_probe_handler = OSDProbeHandler(self.frame_data_queue, self.mapping_config, self.counting_config)

        # Manager instances
        self.diagnostics = Diagnostics(self.video_source, self.pgie_config_path)
        self.config_manager = ConfigManager(self)
        self.pipeline_manager = PipelineManager(self)
        self.service_manager = ServiceManager(self)

    def run(self):
        """
        Executes the main application lifecycle.
        """
        logger.info("DeepStream AI Application Initializing...")
        
        # 1. Pre-computation and checks
        check_and_convert_models()
        self.diagnostics.run_preflight_check()
        
        # 2. Load initial settings
        self.config_manager.load_initial_configs()
        
        # 3. Start background services
        self.service_manager.start_services()
        
        # 4. Build and run the pipeline (this will block until exit)
        try:
            self.pipeline_manager.build_pipeline()
            self.pipeline_manager.run() # This blocks
        except Exception as e:
            logger.critical(f"A critical error occurred during pipeline execution: {e}")
        finally:
            # 5. Graceful shutdown
            logger.info("Initiating graceful shutdown of all services...")
            self.service_manager.stop_services()
            # Pipeline manager's stop is called internally on loop exit
            logger.info("Shutdown complete.")

    # --- Callback Handlers ---
    # These methods are passed to other managers to allow them to interact with the app's state.

    def handle_mapping_update(self, data: dict) -> None:
        """Callback to handle homography configuration updates."""
        logger.info("[WebSocket] Received MAPPING update. Pushing to C++.")
        try:
            correspondences = data.get("correspondences", [])
            cam_pts = [(float(i["camera"][0]), float(i["camera"][1])) for i in correspondences]
            map_pts = [(float(i["map"][0]), float(i["map"][1])) for i in correspondences]
            
            m_sz = data.get("map_size", {})
            map_sz = (int(m_sz.get("width", 723)), int(m_sz.get("height", 1266)))
            
            self.mapping_config.map_size = map_sz
            cpp_probe_service.update_mapping(cam_pts, map_pts, map_sz)
        except Exception as e:
            logger.error(f"Error handling mapping update: {e}")

    def handle_counting_update(self, data: dict) -> None:
        """Callback to handle line crossing configuration updates."""
        logger.info("[WebSocket] Received COUNTING update.")
        try:
            if "line_start" in data and "line_end" in data and "inside_point" in data:
                logger.debug("Pushing line crossing update to C++.")
                start = tuple(data["line_start"])
                end = tuple(data["line_end"])
                inside = tuple(data["inside_point"])
                margin = data.get("crossing_margin", 10)
                cpp_probe_service.update_counting(start, end, inside, margin)
            
            if "info_threshold" in data:
                self.osd_probe_handler.info_threshold = data["info_threshold"]
            if "warning_threshold" in data:
                self.osd_probe_handler.warning_threshold = data["warning_threshold"]
            if "critical_threshold" in data:
                self.osd_probe_handler.critical_threshold = data["critical_threshold"]
        except Exception as e:
            logger.error(f"Error handling counting update: {e}")
