import os
import json
from loguru import logger

class ConfigManager:
    """
    Loads initial configurations for mapping, counting, and thresholds from JSON files.
    """
    def __init__(self, app_instance):
        self.app = app_instance

    def load_initial_configs(self):
        """Loads all initial settings from local JSON files."""
        self._load_config("config/counting_config.json", self.app.handle_counting_update, "Counting")
        self._load_config("config/mapping_config.json", self.app.handle_mapping_update, "Mapping")
        self._load_threshold_config()

    def _load_config(self, path: str, handler, name: str):
        """Generic method to load a JSON config file and call its handler."""
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    cfg = json.load(f)
                handler(cfg)
                logger.info(f"[CONFIG] Initial {name} settings loaded from {path}")
            except Exception as e:
                logger.error(f"[CONFIG] Failed to load initial {name} config: {e}")
        else:
            logger.warning(f"[CONFIG] {name} config file not found at {path}")

    def _load_threshold_config(self):
        """Loads the threshold configuration and applies it to the OSD handler."""
        path = "config/threshold_config.json"
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    cfg = json.load(f)
                
                # Directly update the osd_probe_handler attributes
                if "info_threshold" in cfg:
                    self.app.osd_probe_handler.info_threshold = cfg["info_threshold"]
                if "warning_threshold" in cfg:
                    self.app.osd_probe_handler.warning_threshold = cfg["warning_threshold"]
                if "critical_threshold" in cfg:
                    self.app.osd_probe_handler.critical_threshold = cfg["critical_threshold"]
                
                logger.info(f"[CONFIG] Initial Threshold settings loaded from {path}")
            except Exception as e:
                logger.error(f"[CONFIG] Failed to load initial threshold config: {e}")
        else:
            logger.warning(f"[CONFIG] Threshold config file not found at {path}")
