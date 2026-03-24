from services.mapping_service import MappingService
from services.counting_service import CountingService
from services.tracking_service import TrackingService
from services.video_service import VideoReader, VideoWriter
from config.data_config import OCSortConfig
from config.data_config import CountingConfig
from config.data_config import MappingConfig
import cv2
from yolox.utils.visualize import plot_tracking
from utils.utils import scale_points
import time

args1 = OCSortConfig("config/tracking_config.json")
args2 = CountingConfig("config/counting_config.json")
tracking_service = TrackingService(args=args1)
mapping_config = MappingConfig("config/mapping_config.json")
mapping_service = MappingService(mapping_config=mapping_config)

map_image = cv2.imread("videos/map2d.jpg")
if map_image is None:
    raise RuntimeError("Failed to read map image videos/map2d.jpg")
map_height, map_width = map_image.shape[:2]

reader = VideoReader("./videos/demo.mp4").start()
if reader.width == 0 or reader.height == 0:
    raise RuntimeError("Video has zero width/height; cannot scale points")

fps = reader.fps
video_size = (reader.width, reader.height)
map_size = (int(map_width), int(map_height))

camera_points = mapping_service.camera_points
map_points = mapping_service.map_points
if camera_points is None or map_points is None:
    raise RuntimeError("Mapping config missing correspondence points")

config_camera_size = mapping_service.camera_size or video_size
config_map_size = mapping_service.map_size or map_size

scaled_camera_points = camera_points
scaled_map_points = map_points
if tuple(config_camera_size) != video_size:
    scaled_camera_points = scale_points(camera_points, src_size=config_camera_size, dst_size=video_size)
if tuple(config_map_size) != map_size:
    scaled_map_points = scale_points(map_points, src_size=config_map_size, dst_size=map_size)

mapping_service.update_mapping(
    camera_points=[tuple(pt) for pt in scaled_camera_points.tolist()],
    map_points=[tuple(pt) for pt in scaled_map_points.tolist()],
    camera_size=video_size,
    map_size=map_size,
)

# Initialize counting service with built-in scaling to current frame size
counting_service = CountingService.from_config(args2, current_frame_size=video_size)

vid_writer = VideoWriter("./videos/result_demo.mp4", fps, video_size).start()
map_writer = VideoWriter("./videos/result_map.mp4", fps, map_size).start()

start = time.time()

try:
    while reader.more():
        loop_start = time.time()
        try:
            frame_id, frame = reader.read()
        except: break

        bboxes_tlwh, track_ids, exec_time = tracking_service.predict(frame_id=frame_id, frame=frame, box_type="tlwh")
        counting_service.update(bboxes_tlwh, track_ids)
        
        system_fps = 1.0 / max(1e-5, time.time() - loop_start)

        result_frame = plot_tracking(frame, bboxes_tlwh, track_ids, frame_id=frame_id + 1, fps=system_fps)

        # Overlay entry/exit counts on the frame
        in_count = counting_service.count_in
        out_count = counting_service.count_out
        current = counting_service.current_people
        cv2.putText(result_frame, f"In: {in_count}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2, cv2.LINE_AA)
        cv2.putText(result_frame, f"Out: {out_count}", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2, cv2.LINE_AA)
        cv2.putText(result_frame, f"Current: {current}", (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)

        vid_writer.put(frame_id, result_frame)

        if mapping_service.is_ready:
            # Convert tlwh -> xyxy for mapping (foot point uses x2/y2)
            bboxes_xyxy = [(x, y, x + w, y + h) for (x, y, w, h) in bboxes_tlwh]

            map_frame = map_image.copy()
            mapped_points = mapping_service.project_bboxes(bboxes_xyxy, current_frame_size=video_size, current_map_size=map_size)
            for (mx, my), tid in zip(mapped_points, track_ids):
                cv2.circle(map_frame, (int(round(mx)), int(round(my))), 6, (0, 0, 255), -1)
                cv2.putText(map_frame, str(int(tid)), (int(round(mx)) + 8, int(round(my)) - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
            cv2.putText(map_frame, f"In: {in_count} Out: {out_count} Current: {current}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)
            map_writer.put(frame_id, map_frame)
finally:
    reader.stop()
    vid_writer.stop()
    map_writer.stop()

end = time.time()

print("Started:", start)
print("Ended:", end)
print("During:", end - start)