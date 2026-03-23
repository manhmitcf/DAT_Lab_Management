import os
import subprocess
from loguru import logger

def check_and_convert_models() -> None:
    """Checks for Engine/ONNX existence and builds engine natively if missing."""
    engine_path = os.getenv("MODEL_ENGINE_PATH", "pretrained/ocsort_x_mot20_fp16.engine")
    onnx_path = os.getenv("MODEL_ONNX_PATH", "pretrained/ocsort_x_mot20.onnx")
    pth_path = os.getenv("MODEL_PTH_PATH", "pretrained/ocsort_x_mot20.pth.tar")
    exp_file = os.getenv("MODEL_EXP_FILE", "exps/yolox_x_mix_mot20_ch.py")
    
    if os.path.exists(engine_path):
        return

    logger.warning(f"TensorRT Engine not found at {engine_path}.")
    
    if not os.path.exists(onnx_path):
        logger.warning(f"ONNX model also not found at {onnx_path}.")
        if os.path.exists(pth_path) and os.path.exists(exp_file):
            logger.info("Auto-converting PTH to ONNX...")
            cmd = [
                "python3", "deploy/scripts/export_onnx.py",
                "--output-name", onnx_path,
                "-f", exp_file,
                "-c", pth_path
            ]
            try:
                subprocess.run(cmd, check=True)
                logger.success(f"Successfully converted PTH to ONNX at {onnx_path}")
            except subprocess.CalledProcessError as e:
                logger.error(f"Failed to convert PTH to ONNX: {e}")
                return
        else:
            logger.error("Missing .pth or exp_file for ONNX conversion.")
            return
            
    if os.path.exists(onnx_path):
        logger.info(f"Building TensorRT Engine using trtexec from {onnx_path}...")
        trtexec_cmd = [
            "/usr/src/tensorrt/bin/trtexec",
            f"--onnx={onnx_path}",
            f"--saveEngine={engine_path}",
            "--fp16",
            "--memPoolSize=workspace:7168"
        ]
        try:
            subprocess.run(trtexec_cmd, check=True)
            logger.success(f"Successfully built TensorRT engine at {engine_path}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to build TensorRT engine: {e}")
