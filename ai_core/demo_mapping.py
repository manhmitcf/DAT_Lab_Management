from services.mapping_service import MappingService
from services.counting_service import CountingService
from services.tracking_service import TrackingService
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

cap = cv2.VideoCapture("./videos/demo.mp4")

if not cap.isOpened():
    raise RuntimeError("Failed to open video ./videos/demo.mp4")
width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)  # float
height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)  # float
fps = cap.get(cv2.CAP_PROP_FPS)
if width == 0 or height == 0:
    raise RuntimeError("Video has zero width/height; cannot scale points")

video_size = (int(width), int(height))
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

line_start, line_end, inside_point = args2.line_start, args2.line_end, args2.inside_point
if args2.frame_width and args2.frame_height and width and height:
    scaled_pts = scale_points(
        points=[line_start, line_end, inside_point],
        src_size=(args2.frame_width, args2.frame_height),
        dst_size=(width, height),
    )
    line_start, line_end, inside_point = [tuple(pt) for pt in scaled_pts]

counting_service = CountingService(
    line_start=tuple(line_start),
    line_end=tuple(line_end),
    inside_point=tuple(inside_point),
    crossing_margin=args2.crossing_margin,
)

vid_writer = cv2.VideoWriter("./videos/result_demo.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, (int(width), int(height)))
map_writer = cv2.VideoWriter("./videos/result_map.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, (int(map_width), int(map_height)))

frame_id = 0

start = time.time()

try:
    while True:
        ret_val, frame = cap.read()
        frame_id += 1
        if not ret_val:
            break

        bboxes_tlwh, track_ids, fps = tracking_service.predict(frame_id=frame_id, frame=frame, box_type="tlwh")
        counting_service.update(bboxes_tlwh, track_ids)

        result_frame = plot_tracking(frame, bboxes_tlwh, track_ids, frame_id=frame_id, fps=fps)

        # Overlay entry/exit counts on the frame
        in_count = counting_service.count_in
        out_count = counting_service.count_out
        current = counting_service.current_people
        cv2.putText(result_frame, f"In: {in_count}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2, cv2.LINE_AA)
        cv2.putText(result_frame, f"Out: {out_count}", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2, cv2.LINE_AA)
        cv2.putText(result_frame, f"Current: {current}", (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)

        vid_writer.write(result_frame)

        if mapping_service.is_ready:
            # Convert tlwh -> xyxy for mapping (foot point uses x2/y2)
            bboxes_xyxy = [(x, y, x + w, y + h) for (x, y, w, h) in bboxes_tlwh]

            map_frame = map_image.copy()
            mapped_points = mapping_service.project_bboxes(bboxes_xyxy, current_frame_size=video_size, current_map_size=map_size)
            for (mx, my), tid in zip(mapped_points, track_ids):
                cv2.circle(map_frame, (int(round(mx)), int(round(my))), 6, (0, 0, 255), -1)
                cv2.putText(map_frame, str(int(tid)), (int(round(mx)) + 8, int(round(my)) - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
            cv2.putText(map_frame, f"In: {in_count} Out: {out_count} Current: {current}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)
            map_writer.write(map_frame)
finally:
    cap.release()
    vid_writer.release()
    map_writer.release()

end = time.time()

print("Started:", start)
print("Ended:", end)
print("During:", end - start)
