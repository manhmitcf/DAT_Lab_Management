# import cv2
# import os
#
# video_path = r"D:\DAT_Lab_Management\videos\video_Lab01.mp4"
# output_dir = r"D:\DAT_Lab_Management\frames01"
#
# os.makedirs(output_dir, exist_ok=True)
#
# cap = cv2.VideoCapture(video_path)
# frame_idx = 0
# saved_idx = 0  # dùng để đánh số ảnh đã lưu
#
# while True:
#     ret, frame = cap.read()
#     if not ret:
#         break
#
#     if frame_idx % 30 == 0:
#         frame_name = f"frame_{saved_idx:06d}.jpg"
#         cv2.imwrite(os.path.join(output_dir, frame_name), frame)
#         saved_idx += 1
#
#     frame_idx += 1
#
# cap.release()


import cv2
from deep_sort_realtime.deepsort_tracker import DeepSort
from services.tracking_service import TrackingService

DISPLAY_WIDTH = 960

# Detector (YOLO / service của bạn)
detector = TrackingService()

# DeepSORT
tracker = DeepSort(embedder="mobilenet")

cap = cv2.VideoCapture(r"ai-core\videos\video_Lab02.mp4")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # ===== 1. DETECT =====
    results = detector.predict([frame])
    detections_raw = results[0]

    detections = []
    for det in detections_raw:
        # det = [x1, y1, x2, y2, score, track_id, keypoints...]
        x1, y1, x2, y2 = det[0:4]

        w = x2 - x1
        h = y2 - y1

        score = float(det[4])

        detections.append((
            [x1, y1, w, h],
            score,
            0  # class_id giả (person)
        ))

    # ===== 2. TRACK =====
    tracks = tracker.update_tracks(detections, frame=frame)

    # ===== 3. DRAW =====
    for track in tracks:
        if not track.is_confirmed():
            continue

        track_id = track.track_id
        l, t, r, b = map(int, track.to_ltrb())

        cv2.rectangle(frame, (l, t), (r, b), (0, 255, 0), 2)
        cv2.putText(
            frame,
            f"ID {track_id}",
            (l, t - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2
        )

    # ===== RESIZE FOR DISPLAY =====
    h, w = frame.shape[:2]
    scale = DISPLAY_WIDTH / w
    display_frame = cv2.resize(frame, (DISPLAY_WIDTH, int(h * scale)))

    cv2.imshow("DeepSORT Tracking", display_frame)
    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
