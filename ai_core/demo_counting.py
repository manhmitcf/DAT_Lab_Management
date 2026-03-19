from services.tracking_service import TrackingService
from config.data_config import OCSortConfig
from config.data_config import CountingConfig
import cv2
from yolox.utils.visualize import plot_tracking
from services.counting_service import CountingService
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

video_size = (int(width), int(height))

# Initialize counting service with scaling from config to current frame
counting_service = CountingService(counting_config=args2, current_frame_size=video_size)

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
