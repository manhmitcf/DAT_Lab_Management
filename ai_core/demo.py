from services.tracking_service import TrackingService
from config.data_config import OCSortConfig
import cv2
from yolox.utils.visualize import plot_tracking

args = OCSortConfig("config/tracking_config.json")
tracking_service = TrackingService(args=args)

cap = cv2.VideoCapture("./videos/demo.mp4")
width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)  # float
height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)  # float
fps = cap.get(cv2.CAP_PROP_FPS)

vid_writer = cv2.VideoWriter("./videos/result_demo.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, (int(width), int(height)))

frame_id = 0

while True:
    ret_val, frame = cap.read()
    frame_id += 1
    if not ret_val:
        break

    bboxes, track_ids, fps = tracking_service.predict(frame_id=frame_id, frame=frame, box_type="tlwh")

    result_frame = plot_tracking(frame, bboxes, track_ids, frame_id=frame_id, fps=fps)

    vid_writer.write(result_frame)

cap.release()
vid_writer.release()
