import os
import queue
from loguru import logger

from dotenv import load_dotenv

load_dotenv()

from config.data_config import MappingConfig, CountingConfig, OCSortConfig
from pipeline.model_converter import check_and_convert_models
from pipeline.osd_probe import OSDProbeHandler
from services.counting_service import CountingService
from services.mapping_service import MappingService
from .diagnostics import Diagnostics
from .pipeline_manager import PipelineManager
from .service_manager import ServiceManager

class DeepStreamApp:
    def __init__(self):
        self.frame_data_queue = queue.Queue(maxsize=100)
        self.janus_ip = os.getenv("JANUS_SERVER_IP", "127.0.0.1")
        self.janus_port = int(os.getenv("JANUS_UDP_PORT", "8000"))
        self.video_source = os.getenv("INPUT_VIDEO_SOURCE", "/dev/video0")
        self.pgie_config_path = os.getenv("PGIE_CONFIG_PATH", "deploy/DeepStream/config_infer_primary_yolox.txt")

        self.mapping_config = MappingConfig("config/mapping_config.json")
        self.counting_config = CountingConfig(json_path="config/counting_config.json")
        self.ocsort_config = OCSortConfig("config/tracking_config.json")

        self.mapping_service = MappingService(mapping_config=self.mapping_config)
        self.counting_service = CountingService(counting_config=self.counting_config, current_frame_size=(1920, 1080))
        
        self.osd_probe_handler = OSDProbeHandler(
            frame_data_queue=self.frame_data_queue,
            counting_service=self.counting_service,
            mapping_service=self.mapping_service,
            ocsort_config=self.ocsort_config 
        )
        
        self.load_initial_thresholds()

        self.diagnostics = Diagnostics(self.video_source, self.pgie_config_path)
        self.pipeline_manager = PipelineManager(self)
        self.service_manager = ServiceManager(self)

    def load_initial_thresholds(self):
        import json
        threshold_path = "config/threshold_config.json"
        if os.path.exists(threshold_path):
            try:
                with open(threshold_path, 'r') as f:
                    cfg = json.load(f)
                if "info_threshold" in cfg: self.osd_probe_handler.info_threshold = cfg["info_threshold"]
                if "warning_threshold" in cfg: self.osd_probe_handler.warning_threshold = cfg["warning_threshold"]
                if "critical_threshold" in cfg: self.osd_probe_handler.critical_threshold = cfg["critical_threshold"]
                logger.info(f"[CONFIG] Initial Threshold settings loaded from {threshold_path}")
            except Exception as e:
                logger.error(f"[CONFIG] Failed to load initial threshold config: {e}")

    def run(self):
        logger.info("DeepStream AI Application Initializing...")
        check_and_convert_models()
        self.diagnostics.run_preflight_check()
        self.service_manager.start_services()
        
        try:
            self.pipeline_manager.build_pipeline()
            
            processing_width = self.pipeline_manager.streammux.get_property("width")
            processing_height = self.pipeline_manager.streammux.get_property("height")
            correct_processing_size = (processing_width, processing_height)
            
            model_input_size = (self.ocsort_config.tsize, self.ocsort_config.tsize)
            
            logger.info(f"Pipeline built. True processing size: {correct_processing_size}. Model input size: {model_input_size}.")

            self.osd_probe_handler.set_frame_sizes(
                processing_size=correct_processing_size,
                model_input_size=model_input_size
            )

            self.handle_counting_update({
                "line_start": self.counting_config.line_start,
                "line_end": self.counting_config.line_end,
                "inside_point": self.counting_config.inside_point,
                "crossing_margin": self.counting_config.crossing_margin,
                "frame_width": 1920,
                "frame_height": 1080
            }, is_initial_setup=True)

            self.pipeline_manager.run()
        except Exception as e:
            logger.critical(f"A critical error occurred during pipeline execution: {e}")
        finally:
            logger.info("Initiating graceful shutdown of all services...")
            self.service_manager.stop_services()
            logger.info("Shutdown complete.")

    # === START OF FIX ===
    # Restore the callback handler methods required by ServiceManager.
    def handle_mapping_update(self, data: dict) -> None:
        """Callback to handle homography configuration updates from WebSocket."""
        logger.info("[WebSocket] Received MAPPING update. Updating Python MappingService.")
        try:
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
        """Callback to handle counting configuration updates from WebSocket."""
        if not is_initial_setup:
            logger.info("[WebSocket] Received COUNTING update. Updating Python CountingService.")
        
        try:
            if "line_start" in data and "line_end" in data and "inside_point" in data:
                
                source_frame_size = (data.get("frame_width", 1920), data.get("frame_height", 1080))
                current_frame_size = (self.pipeline_manager.streammux.get_property("width"), self.pipeline_manager.streammux.get_property("height"))

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

            if "info_threshold" in data: self.osd_probe_handler.info_threshold = data["info_threshold"]
            if "warning_threshold" in data: self.osd_probe_handler.warning_threshold = data["warning_threshold"]
            if "critical_threshold" in data: self.osd_probe_handler.critical_threshold = data["critical_threshold"]
        except Exception as e:
            logger.error(f"Error handling counting update: {e}")
    # === END OF FIX ===
