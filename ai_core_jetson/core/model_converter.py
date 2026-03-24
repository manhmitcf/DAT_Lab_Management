"""
Model Conversion Utility for Jetson DeepStream Pipeline.

Handles the full model pipeline:
    PTH (PyTorch) → ONNX → TensorRT Engine (.engine)

Usage:
    - As a module:  from core.model_converter import check_and_convert_models
    - As a script:  python -m core.model_converter

Environment Variables:
    MODEL_ENGINE_PATH:  Path to TensorRT engine          (default: pretrained/yolox_x_mot20_fp16.engine)
    MODEL_ONNX_PATH:    Path to ONNX model               (default: pretrained/yolox_x_mot20.onnx)
    MODEL_PTH_PATH:     Path to PyTorch checkpoint        (default: pretrained/ocsort_x_mot20.pth.tar)
    MODEL_EXP_FILE:     Path to YOLOX experiment file     (default: exps/yolox_x_mix_mot20_ch.py)
    TRT_FP16:           Enable FP16 precision             (default: 1)
    TRT_WORKSPACE_MB:   TensorRT workspace size in MB     (default: 7168)
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

from loguru import logger


# ──────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────
DEFAULT_ENGINE_PATH = "pretrained/yolox_x_mot20_fp16.engine"
DEFAULT_ONNX_PATH   = "pretrained/yolox_x_mot20.onnx"
DEFAULT_PTH_PATH    = "pretrained/ocsort_x_mot20.pth.tar"
DEFAULT_EXP_FILE    = "exps/yolox_x_mix_mot20_ch.py"

TRTEXEC_CANDIDATES = [
    "/usr/src/tensorrt/bin/trtexec",
    "/usr/local/tensorrt/bin/trtexec",
    shutil.which("trtexec") or "",
]


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
def _find_trtexec() -> Optional[str]:
    """Locate the trtexec binary on the system."""
    for path in TRTEXEC_CANDIDATES:
        if path and os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    return None


def _run(cmd: list[str], description: str) -> bool:
    """Run a subprocess with logging."""
    logger.info(f"[ModelConverter] Running: {' '.join(cmd)}")
    try:
        subprocess.run(cmd, check=True, stdout=sys.stdout, stderr=sys.stderr)
        logger.success(f"[ModelConverter] ✅ {description} succeeded.")
        return True
    except FileNotFoundError:
        logger.error(f"[ModelConverter] ❌ Command not found: {cmd[0]}")
        return False
    except subprocess.CalledProcessError as e:
        logger.error(f"[ModelConverter] ❌ {description} failed (exit code {e.returncode}).")
        return False


# ──────────────────────────────────────────────────────────────
# Stage 1: PTH → ONNX
# ──────────────────────────────────────────────────────────────
def convert_pth_to_onnx(
    pth_path: str,
    exp_file: str,
    onnx_path: str,
    opset: int = 11,
) -> bool:
    """
    Convert a PyTorch checkpoint (.pth.tar) to ONNX format
    using the existing deploy/scripts/export_onnx.py script.

    Args:
        pth_path: Path to the .pth.tar checkpoint.
        exp_file: Path to the YOLOX experiment Python file.
        onnx_path: Output path for the ONNX model.
        opset: ONNX opset version.

    Returns:
        True if conversion succeeded, False otherwise.
    """
    if not os.path.isfile(pth_path):
        logger.error(f"[ModelConverter] PTH checkpoint not found: {pth_path}")
        return False

    if not os.path.isfile(exp_file):
        logger.error(f"[ModelConverter] Experiment file not found: {exp_file}")
        return False

    # Ensure output directory exists
    os.makedirs(os.path.dirname(onnx_path) or ".", exist_ok=True)

    cmd = [
        sys.executable,  # Use the current Python interpreter
        "deploy/scripts/export_onnx.py",
        "--output-name", onnx_path,
        "-f", exp_file,
        "-c", pth_path,
        "-o", str(opset),
    ]

    return _run(cmd, f"PTH → ONNX ({os.path.basename(onnx_path)})")


# ──────────────────────────────────────────────────────────────
# Stage 2: ONNX → TensorRT Engine
# ──────────────────────────────────────────────────────────────
def convert_onnx_to_engine(
    onnx_path: str,
    engine_path: str,
    fp16: bool = True,
    workspace_mb: int = 7168,
) -> bool:
    """
    Build a TensorRT engine from an ONNX model using trtexec.

    Args:
        onnx_path: Path to the ONNX model.
        engine_path: Output path for the serialized TensorRT engine.
        fp16: Whether to enable FP16 precision (recommended for Jetson).
        workspace_mb: GPU workspace size in MB.

    Returns:
        True if conversion succeeded, False otherwise.
    """
    trtexec = _find_trtexec()
    if trtexec is None:
        logger.error(
            "[ModelConverter] trtexec not found! "
            "Ensure TensorRT is installed. Searched: "
            + ", ".join(p for p in TRTEXEC_CANDIDATES if p)
        )
        return False

    if not os.path.isfile(onnx_path):
        logger.error(f"[ModelConverter] ONNX model not found: {onnx_path}")
        return False

    # Ensure output directory exists
    os.makedirs(os.path.dirname(engine_path) or ".", exist_ok=True)

    cmd = [
        trtexec,
        f"--onnx={onnx_path}",
        f"--saveEngine={engine_path}",
        f"--memPoolSize=workspace:{workspace_mb}",
    ]

    if fp16:
        cmd.append("--fp16")

    logger.info(f"[ModelConverter] Building TensorRT engine (FP16={fp16}, workspace={workspace_mb}MB)...")
    logger.info(f"[ModelConverter] ⏳ This may take 10-30 minutes on Jetson...")

    return _run(cmd, f"ONNX → TensorRT Engine ({os.path.basename(engine_path)})")


# ──────────────────────────────────────────────────────────────
# Main Entry Point
# ──────────────────────────────────────────────────────────────
def check_and_convert_models() -> None:
    """
    Full auto-conversion pipeline:
        1. If .engine exists → skip (already ready).
        2. If .onnx exists  → build engine from ONNX.
        3. If .pth exists   → convert PTH → ONNX → Engine.
        4. If nothing exists → abort with clear error message.
    """
    engine_path = os.getenv("MODEL_ENGINE_PATH", DEFAULT_ENGINE_PATH)
    onnx_path   = os.getenv("MODEL_ONNX_PATH",   DEFAULT_ONNX_PATH)
    pth_path    = os.getenv("MODEL_PTH_PATH",     DEFAULT_PTH_PATH)
    exp_file    = os.getenv("MODEL_EXP_FILE",     DEFAULT_EXP_FILE)
    fp16        = os.getenv("TRT_FP16", "1") == "1"
    workspace   = int(os.getenv("TRT_WORKSPACE_MB", "7168"))

    logger.info("=" * 60)
    logger.info("[ModelConverter] Checking model files...")
    logger.info(f"  Engine : {engine_path}")
    logger.info(f"  ONNX   : {onnx_path}")
    logger.info(f"  PTH    : {pth_path}")
    logger.info(f"  Exp    : {exp_file}")
    logger.info("=" * 60)

    # ── Step 1: Engine already exists ─────────────────────────
    if os.path.isfile(engine_path):
        size_mb = os.path.getsize(engine_path) / (1024 * 1024)
        logger.success(f"[ModelConverter] ✅ TensorRT engine found ({size_mb:.1f} MB). Ready to go!")
        return

    logger.warning(f"[ModelConverter] TensorRT engine not found at: {engine_path}")

    # ── Step 2: ONNX → Engine ────────────────────────────────
    if os.path.isfile(onnx_path):
        logger.info(f"[ModelConverter] ONNX model found at: {onnx_path}")
        success = convert_onnx_to_engine(onnx_path, engine_path, fp16=fp16, workspace_mb=workspace)
        if success:
            return
        else:
            logger.error("[ModelConverter] ❌ Engine build failed. Check logs above.")
            sys.exit(1)

    logger.warning(f"[ModelConverter] ONNX model not found at: {onnx_path}")

    # ── Step 3: PTH → ONNX → Engine ─────────────────────────
    if os.path.isfile(pth_path) and os.path.isfile(exp_file):
        logger.info("[ModelConverter] Found PTH checkpoint — starting full conversion pipeline.")

        # Stage 1: PTH → ONNX
        if not convert_pth_to_onnx(pth_path, exp_file, onnx_path):
            logger.error("[ModelConverter] ❌ PTH → ONNX conversion failed.")
            sys.exit(1)

        # Stage 2: ONNX → Engine
        if not convert_onnx_to_engine(onnx_path, engine_path, fp16=fp16, workspace_mb=workspace):
            logger.error("[ModelConverter] ❌ ONNX → Engine build failed.")
            sys.exit(1)

        return

    # ── Step 4: Nothing available ────────────────────────────
    logger.error("=" * 60)
    logger.error("[ModelConverter] ❌ NO MODEL FILES FOUND!")
    logger.error(f"  Checked engine : {engine_path}")
    logger.error(f"  Checked ONNX   : {onnx_path}")
    logger.error(f"  Checked PTH    : {pth_path}")
    logger.error(f"  Checked exp    : {exp_file}")
    logger.error("")
    logger.error("  Please provide at least ONE of the following:")
    logger.error("    1. A TensorRT engine file (.engine)")
    logger.error("    2. An ONNX model file (.onnx)")
    logger.error("    3. A PyTorch checkpoint (.pth.tar) + experiment file (.py)")
    logger.error("=" * 60)
    sys.exit(1)


# ──────────────────────────────────────────────────────────────
# CLI Entry Point
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    check_and_convert_models()
