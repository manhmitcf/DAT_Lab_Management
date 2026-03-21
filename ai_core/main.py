import os
import time
import cv2
import requests
from datetime import datetime, timezone

try:
    # Load .env if python-dotenv is available
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from config.data_config import OCSortConfig, CountingConfig, MappingConfig
from services.pipeline_service import PipelineService
from services.backend_gateway import ResultPublisher, SettingsSubscriber
from services.cpp_probe_service import cpp_probe_service
from loguru import logger

def setup_pipeline(video_size, map_size):
    """Initialize configuration and setup the main pipeline."""
    logger.info("Setting up pipeline configurations...")
    tracking_cfg = OCSortConfig("config/tracking_config.json")
    counting_cfg = CountingConfig("config/counting_config.json")
    mapping_cfg = MappingConfig("config/mapping_config.json")

    pipeline = PipelineService(
        tracking_config=tracking_cfg,
        counting_config=counting_cfg,
        mapping_config=mapping_cfg,
        video_size=video_size,
        map_size=map_size,
    )
    logger.success("Pipeline setup complete.")
    return pipeline

def create_settings_subscriber(pipeline, video_size):
    """Create a subscriber to handle settings updates from backend."""
    def handle_mapping_update(data):
        logger.info("Received MAPPING update from backend")
        try:
            correspondences = data.get("correspondences", [])
            camera_points = []
            map_points = []
            for item in correspondences:
                cam = item.get("camera")
                mp = item.get("map")
                if cam and mp:
                    camera_points.append((float(cam[0]), float(cam[1])))
                    map_points.append((float(mp[0]), float(mp[1])))
            
            img_size = data.get("image_size", {})
            camera_size_config = (int(img_size.get("width", 1920)), int(img_size.get("height", 1080)))
            
            m_size = data.get("map_size", {})
            map_size_config = (int(m_size.get("width", 723)), int(m_size.get("height", 1266)))
            
            pipeline.mapping_service.update_mapping(
                camera_points=camera_points,
                map_points=map_points,
                camera_size=camera_size_config,
                map_size=map_size_config
            )
            # Send mapping update to C++ probe shared memory
            cpp_probe_service.update_mapping(camera_points, map_points, map_size_config)
            
            logger.success("Mapping service updated successfully")
        except Exception as e:
            logger.error(f"Error updating Mapping service: {e}")

    def handle_counting_update(data):
        logger.info("Received COUNTING update from backend")
        try:
            pipeline.counting_service.update_config(
                line_start=tuple(data.get("line_start")),
                line_end=tuple(data.get("line_end")),
                inside_point=tuple(data.get("inside_point")),
                crossing_margin=data.get("crossing_margin", 10),
                source_frame_size=(data.get("frame_width", 1920), data.get("frame_height", 1080)),
                current_frame_size=video_size
            )
            
            # Send counting update to C++ probe shared memory
            line_start = tuple(data.get("line_start"))
            line_end = tuple(data.get("line_end"))
            inside_point = tuple(data.get("inside_point"))
            margin = data.get("crossing_margin", 10)
            cpp_probe_service.update_counting(line_start, line_end, inside_point, margin)
            
            logger.success("Counting service updated successfully")
        except Exception as e:
            logger.error(f"Error updating Counting service: {e}")

    return SettingsSubscriber(
        on_mapping_update=handle_mapping_update,
        on_counting_update=handle_counting_update
    )

def main():
    logger.info("Starting main application...")
    video_path = "./videos/demo.mp4"
    map_path = "videos/map2d.jpg"

    # Read map image just to get its dimensions
    logger.info(f"Loading map image from: {map_path}")
    map_image = cv2.imread(map_path)
    if map_image is None:
        logger.error(f"Failed to read map image from {map_path}")
        raise RuntimeError(f"Failed to read map image {map_path}")
    map_h, map_w = map_image.shape[:2]
    map_size = (int(map_w), int(map_h))
    logger.info(f"Map size configured as: {map_size}")

    # Open video capture
    logger.info(f"Opening video file: {video_path}")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error(f"Failed to open video from {video_path}")
        raise RuntimeError(f"Failed to open video {video_path}")

    width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    target_fps = fps if fps and fps > 1e-3 else 30.0
    target_dt = 1.0 / target_fps
    
    if width == 0 or height == 0:
        logger.error("Video has zero width/height. Cannot process.")
        raise RuntimeError("Video has zero width/height; cannot process")

    video_size = (int(width), int(height))
    logger.info(f"Video loaded successfully. Size: {video_size}, FPS: {fps:.2f}, Target dt: {target_dt:.4f}s")

    # Initialize Pipeline and Publisher
    pipeline = setup_pipeline(video_size, map_size)
    publisher = ResultPublisher()
    
    # Initialize Settings Subscriber
    logger.info("Starting settings subscriber for backend updates...")
    settings_sub = create_settings_subscriber(pipeline, video_size)
    settings_sub.start()

    frame_id = 0
    start_time = time.time()
    
    logger.info("Entering main processing loop...")
    try:
        while True:
            loop_start = time.perf_counter()
            
            ret_val, frame = cap.read()
            if not ret_val:
                logger.info("End of video stream reached.")
                break
                
            frame_id += 1

            # Get timestamp for current frame
            ts_msec = cap.get(cv2.CAP_PROP_POS_MSEC)
            if ts_msec and ts_msec > 0:
                ts_dt = datetime.fromtimestamp(ts_msec / 1000.0, tz=timezone.utc)
            else:
                ts_dt = datetime.now(timezone.utc)

            # Process frame using pipeline
            frame_data = pipeline.process_frame(frame=frame, frame_id=frame_id, timestamp=ts_dt)
            
            # Log periodic statistics (e.g., every 30 frames)
            if frame_id % 30 == 0:
                current_count = max(0, frame_data.count_in - frame_data.count_out)
                logger.debug(
                    f"Frame {frame_id:04d} | Tracks: {len(frame_data.objects):02d} | "
                    f"In: {frame_data.count_in:02d} | Out: {frame_data.count_out:02d} | "
                    f"Current: {current_count:02d}"
                )

            # Send processing results to backend
            try:
                publisher.send_frame(frame_data)
            except requests.RequestException as exc:
                logger.error(f"Failed to publish frame {frame_id}: {exc}")

            # Match target FPS by sleeping if processing is faster than target dt
            elapsed = time.perf_counter() - loop_start
            if elapsed < target_dt:
                time.sleep(target_dt - elapsed)

    except KeyboardInterrupt:
        logger.warning("Processing interrupted by user (KeyboardInterrupt).")
    except Exception as e:
        logger.exception(f"An unexpected error occurred during processing: {e}")
    finally:
        logger.info("Cleaning up resources...")
        settings_sub.stop()
        cap.release()

    end_time = time.time()
    total_time = end_time - start_time
    avg_fps = frame_id / total_time if total_time > 0 else 0
    logger.success(
        f"Processing finished successfully.\n"
        f"Total frames processed: {frame_id}\n"
        f"Total time taken: {total_time:.2f}s\n"
        f"Average FPS: {avg_fps:.2f}"
    )

if __name__ == "__main__":
    main()
