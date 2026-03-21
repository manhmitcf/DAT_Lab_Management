import os
import time
import cv2
import requests
from datetime import datetime, timezone
from yolox.utils.visualize import plot_tracking

try:
    # Load .env if python-dotenv is available
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from config.data_config import OCSortConfig, CountingConfig, MappingConfig
from services.pipeline_service import PipelineService
from services.backend_gateway import ResultPublisher, SettingsSubscriber
from loguru import logger


def main():
    video_path = "./videos/demo.mp4"
    map_path = "videos/map2d.jpg"

    map_image = cv2.imread(map_path)
    if map_image is None:
        raise RuntimeError(f"Failed to read map image {map_path}")
    map_h, map_w = map_image.shape[:2]
    map_size = (int(map_w), int(map_h))

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video {video_path}")

    width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    target_fps = fps if fps and fps > 1e-3 else 30.0
    target_dt = 1.0 / target_fps
    if width == 0 or height == 0:
        raise RuntimeError("Video has zero width/height; cannot process")

    video_size = (int(width), int(height))

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

    publisher = ResultPublisher()

    def handle_mapping_update(data):
        logger.info(">>> Received MAPPING update from backend")
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
            logger.success(">>> Mapping service updated successfully!")
        except Exception as e:
            logger.error(f">>> Error updating Mapping service: {e}")

    def handle_counting_update(data):
        logger.info(">>> Received COUNTING update from backend")
        try:
            pipeline.counting_service.update_config(
                line_start=tuple(data.get("line_start")),
                line_end=tuple(data.get("line_end")),
                inside_point=tuple(data.get("inside_point")),
                crossing_margin=data.get("crossing_margin", 10),
                source_frame_size=(data.get("frame_width", 1920), data.get("frame_height", 1080)),
                current_frame_size=video_size
            )
            logger.success(">>> Counting service updated successfully!")
        except Exception as e:
            logger.error(f">>> Error updating Counting service: {e}")

    settings_sub = SettingsSubscriber(
        on_mapping_update=handle_mapping_update,
        on_counting_update=handle_counting_update
    )
    settings_sub.start()

    # Writers for counting video and mapped 2D view
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    counting_writer = cv2.VideoWriter("./videos/result_demo.mp4", fourcc, fps, (int(width), int(height)))
    map_writer = cv2.VideoWriter("./videos/result_map.mp4", fourcc, fps, (int(map_w), int(map_h)))

    frame_id = 0
    start = time.time()

    try:
        while True:
            loop_start = time.perf_counter()
            ret_val, frame = cap.read()
            if not ret_val:
                break
            frame_id += 1

            ts_msec = cap.get(cv2.CAP_PROP_POS_MSEC)
            if ts_msec and ts_msec > 0:
                ts_dt = datetime.fromtimestamp(ts_msec / 1000.0, tz=timezone.utc)
            else:
                ts_dt = datetime.now(timezone.utc)

            frame_data = pipeline.process_frame(frame=frame, frame_id=frame_id, timestamp=ts_dt)

            # Draw tracking + counting overlay
            bboxes_tlwh = []
            track_ids = []
            for obj in frame_data.objects:
                x1, y1, x2, y2 = obj.bbox
                bboxes_tlwh.append([x1, y1, x2 - x1, y2 - y1])
                track_ids.append(obj.track_id)

            result_frame = plot_tracking(frame.copy(), bboxes_tlwh, track_ids, frame_id=frame_id, fps=fps)
            cv2.putText(result_frame, f"In: {frame_data.count_in}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2, cv2.LINE_AA)
            cv2.putText(result_frame, f"Out: {frame_data.count_out}", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2, cv2.LINE_AA)
            cv2.putText(result_frame, f"Current: {max(0, frame_data.count_in - frame_data.count_out)}", (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)
            # Draw margin region to visualize counting line thickness
            pipeline.counting_service.draw_margin_region(result_frame)
            counting_writer.write(result_frame)

            # Draw mapped points on 2D map
            map_frame = map_image.copy()
            for obj in frame_data.objects:
                mx, my = obj.coordinates_2D
                cv2.circle(map_frame, (int(round(mx)), int(round(my))), 6, (0, 0, 255), -1)
                cv2.putText(map_frame, str(int(obj.track_id)), (int(round(mx)) + 8, int(round(my)) - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
            cv2.putText(
                map_frame,
                f"In: {frame_data.count_in} Out: {frame_data.count_out} Current: {max(0, frame_data.count_in - frame_data.count_out)}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )
            map_writer.write(map_frame)

            try:
                publisher.send_frame(frame_data)
            except requests.RequestException as exc:
                # Log and continue without stopping the loop
                logger.error(f"Failed to publish frame {frame_id}: {exc}")

            elapsed = time.perf_counter() - loop_start
            if elapsed < target_dt:
                time.sleep(target_dt - elapsed)

    finally:
        settings_sub.stop()
        cap.release()
        counting_writer.release()
        map_writer.release()

    end = time.time()
    logger.info(f"Processed {frame_id} frames in {end - start:.2f}s")


if __name__ == "__main__":
    main()

