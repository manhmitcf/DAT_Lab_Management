import os
import queue
from loguru import logger

from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

from config.data_config import MappingConfig, CountingConfig
from pipeline.model_converter import check_and_convert_models
from pipeline.osd_probe import OSDProbeHandler

# Import the original Python services
from services.counting_service import CountingService
from services.mapping_service import MappingService

from .diagnostics import Diagnostics
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

        # --- INITIALIZE PYTHON SERVICES ---
        
        # 1. Load the initial configuration files into config objects
        self.mapping_config = MappingConfig("config/mapping_config.json")
        self.counting_config = CountingConfig(json_path="config/counting_config.json")

        # 2. Initialize services with a placeholder size. This will be corrected after the pipeline starts.
        initial_video_size = (1920, 1080)

        self.mapping_service = MappingService(mapping_config=self.mapping_config)
        self.counting_service = CountingService(
            counting_config=self.counting_config,
            current_frame_size=initial_video_size 
        )
        
        # 3. Initialize the OSDProbeHandler and pass the Python services to it
        self.osd_probe_handler = OSDProbeHandler(
            frame_data_queue=self.frame_data_queue,
            counting_service=self.counting_service,
            mapping_service=self.mapping_service
        )
        
        self.load_initial_thresholds()

        # Manager instances
        self.diagnostics = Diagnostics(self.video_source, self.pgie_config_path)
        self.pipeline_manager = PipelineManager(self)
        self.service_manager = ServiceManager(self)

    def load_initial_thresholds(self):
        """Loads thresholds from the config file and updates the probe handler."""
        import json
        threshold_path = "config/threshold_config.json"
        if os.path.exists(threshold_path):
            try:
                with open(threshold_path, 'r') as f:
                    cfg = json.load(f)
                if "info_threshold" in cfg:
                    self.osd_probe_handler.info_threshold = cfg["info_threshold"]
                if "warning_threshold" in cfg:
                    self.osd_probe_handler.warning_threshold = cfg["warning_threshold"]
                if "critical_threshold" in cfg:
                    self.osd_probe_handler.critical_threshold = cfg["critical_threshold"]
                logger.info(f"[CONFIG] Initial Threshold settings loaded from {threshold_path}")
            except Exception as e:
                logger.error(f"[CONFIG] Failed to load initial threshold config: {e}")

    def run(self):
        """
        Executes the main application lifecycle.
        """
        logger.info("DeepStream AI Application Initializing...")
        
        check_and_convert_models()
        self.diagnostics.run_preflight_check()
        
        self.service_manager.start_services()
        
        try:
            self.pipeline_manager.build_pipeline()
            
            # === START OF LOGIC FIX ===
            # After the pipeline is built, we know the true video size.
            # We must now re-apply the original configuration with the correct scaling information.
            logger.info("Pipeline built. Applying correct scaling to services...")
            
            # Use the original config data as the source of truth.
            # Assume the config coordinates were defined on a 1920x1080 reference frame.
            self.handle_counting_update({
                "line_start": self.counting_config.line_start,
                "line_end": self.counting_config.line_end,
                "inside_point": self.counting_config.inside_point,
                "crossing_margin": self.counting_config.crossing_margin,
                "frame_width": 1920,  # Hardcode the reference width
                "frame_height": 1080 # Hardcode the reference height
            }, is_initial_setup=True)
            # === END OF LOGIC FIX ===

            self.pipeline_manager.run() # This blocks
        except Exception as e:
            logger.critical(f"A critical error occurred during pipeline execution: {e}")
        finally:
            logger.info("Initiating graceful shutdown of all services...")
            self.service_manager.stop_services()
            logger.info("Shutdown complete.")

    def handle_mapping_update(self, data: dict) -> None:
        """Callback to handle homography configuration updates."""
        logger.info("[WebSocket] Received MAPPING update. Updating Python MappingService.")
        try:
            # This logic is correct as it re-calculates homography from scratch
            correspondences = data.get("correspondences", [])
            cam_pts = [(float(i["camera"][0]), float(i["camera"][1])) for i in correspondences]
            map_pts = [(float(i["map"][0]), float(i["map"][1])) for i in correspondences]
            
            cam_sz = data.get("image_size", {})
            camera_size = (int(cam_sz.get("width", 1920)), int(cam_sz.get("height", 1080)))
            
            m_sz = data.get("map_size", {})
            map_size = (int(m_sz.get("width", 723)), int(m_sz.get("height", 1266)))
            
            self.mapping_service.update_mapping(
                camera_points=cam_pts,
                map_points=map_pts,
                camera_size=camera_size,
                map_size=map_size
            )
            logger.success("Python MappingService updated successfully.")
        except Exception as e:
            logger.error(f"Error handling mapping update: {e}")

    def handle_counting_update(self, data: dict, is_initial_setup: bool = False) -> None:
        """Callback to handle line crossing configuration updates."""
        if not is_initial_setup:
            logger.info("[WebSocket] Received COUNTING update. Updating Python CountingService.")
        
        try:
            if "line_start" in data and "line_end" in data and "inside_point" in data:
                
                # The source frame size is the one the coordinates were defined on (from backend or config file)
                source_frame_size = (data.get("frame_width", 1920), data.get("frame_height", 1080))
                # The current frame size is the actual runtime size of the pipeline
                current_frame_size = (self.pipeline_manager.streammux.get_property("width"), self.pipeline_manager.streammux.get_property("height"))

                # Call the update method of the Python service, which handles scaling
                self.counting_service.update_config(
                    line_start=tuple(data["line_start"]),
                    line_end=tuple(data["line_end"]),
                    inside_point=tuple(data["inside_point"]),
                    crossing_margin=data.get("crossing_margin", 10),
                    source_frame_size=source_frame_size,
                    current_frame_size=current_frame_size
                )
                if not is_initial_setup:
                    logger.success("Python CountingService updated successfully.")

            # Update alert thresholds if they are in the payload
            if "info_threshold" in data:
                self.osd_probe_handler.info_threshold = data["info_threshold"]
            if "warning_threshold" in data:
                self.osd_probe_handler.warning_threshold = data["warning_threshold"]
            if "critical_threshold" in data:
                self.osd_probe_handler.critical_threshold = data["critical_threshold"]
        except Exception as e:
            logger.error(f"Error handling counting update: {e}")
