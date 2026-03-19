from services.tracking_service import TrackingService
from config.data_config import OCSortConfig
from config.data_config import CountingConfig
import cv2
from yolox.utils.visualize import plot_tracking
from services.counting_service import CountingService
from utils.utils import scale_points
import time

args1 = OCSortConfig("config/tracking_config.json")
args2 = CountingConfig("config/counting_config.json")
tracking_service = TrackingService(args=args1)

cap = cv2.VideoCapture("./videos/demo.mp4")
if not cap.isOpened():
    raise RuntimeError("Failed to open video ./videos/demo.mp4")
width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)  # float
height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)  # float
fps = cap.get(cv2.CAP_PROP_FPS)
if width == 0 or height == 0:
    raise RuntimeError("Video has zero width/height; cannot scale points")

line_start, line_end, inside_point = args2.line_start, args2.line_end, args2.inside_point
if args2.frame_width and args2.frame_height and width and height:
    scaled_pts = scale_points(
        [line_start, line_end, inside_point],
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

frame_id = 0

start = time.time()

while True:
    ret_val, frame = cap.read()
    frame_id += 1
    if not ret_val:
        break

    bboxes, track_ids, fps = tracking_service.predict(frame_id=frame_id, frame=frame, box_type="tlwh")
    counting_service.update(bboxes, track_ids)

    result_frame = plot_tracking(frame, bboxes, track_ids, frame_id=frame_id, fps=fps)

    # Overlay entry/exit counts on the frame
    in_count = counting_service.count_in
    out_count = counting_service.count_out
    current = counting_service.current_people
    cv2.putText(result_frame, f"In: {in_count}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2, cv2.LINE_AA)
    cv2.putText(result_frame, f"Out: {out_count}", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2, cv2.LINE_AA)
    cv2.putText(result_frame, f"Current: {current}", (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)

    vid_writer.write(result_frame)

cap.release()
vid_writer.release()

end = time.time()

print("Started:", start)
print("Ended:", end)
print("During:", end - start)
