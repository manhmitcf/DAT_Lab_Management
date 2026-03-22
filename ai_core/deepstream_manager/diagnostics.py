import os
from loguru import logger

try:
    import pyds
except ImportError:
    pyds = None

class Diagnostics:
    """
    Handles pre-flight diagnostic checks to ensure system readiness.
    """
    def __init__(self, video_source: str, pgie_config_path: str):
        self.video_source = video_source
        self.pgie_config_path = pgie_config_path

    def run_preflight_check(self) -> bool:
        """Runs essential diagnostic checks before starting the pipeline."""
        success = True
        logger.info("━" * 60)
        logger.info("[DIAGNOSTIC] Checking system readiness...")
        logger.info("━" * 60)

        # 1. Check Video Source
        if os.path.exists(self.video_source):
            logger.success(f"[SOURCE] Found source: {self.video_source}")
        else:
            logger.error(f"[SOURCE] Source NOT FOUND: {self.video_source}. Pipeline will fail.")
            success = False

        # 2. Check Critical Files and Directories
        files_to_check = {
            "YOLOX Engine": "pretrained/ocsort_x_mot20_fp16.engine",
            "PGIE Config": self.pgie_config_path,
            "OCSort Lib": "deploy/OCSort/cpp/build/libnvds_ocsort.so",
            "Parser Lib": "deploy/DeepStream/libnvdsinfer_custom_impl_YoloX.so",
            "Mapping Config": "config/mapping_config.json",
            "Counting Config": "config/counting_config.json",
            "Threshold Config": "config/threshold_config.json",
            ".env File": "config/.env" # Corrected path
        }
        for name, path in files_to_check.items():
            if os.path.exists(path):
                logger.success(f"[FILE] {name:15} | Found: {path}")
            else:
                logger.error(f"[FILE] {name:15} | NOT FOUND: {path}")
                success = False

        # 3. Check pyds
        if pyds:
            logger.success("[PYTHON] pyds bindings loaded successfully.")
        else:
            logger.warning("[PYTHON] pyds NOT found. OSD logic will be skipped.")

        # 4. Check Environment
        required_env = ["RESULTS_WS_URL", "MAPPING_SETTINGS_WS_URL", "COUNTING_SETTINGS_WS_URL"]
        for env in required_env:
            if os.getenv(env):
                logger.success(f"[ENV] {env:25} | Set")
            else:
                logger.warning(f"[ENV] {env:25} | NOT SET")

        logger.info("━" * 60)
        if success:
            logger.success("[DIAGNOSTIC] Pre-flight checks passed.")
        else:
            logger.warning("[DIAGNOSTIC] Pre-flight checks failed. Attempting to start anyway...")
        logger.info("━" * 60)
        return success
