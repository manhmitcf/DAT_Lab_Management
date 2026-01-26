from ai_core.config import configuration as config
from ultralytics import YOLO
import cv2
import numpy as np
from abc import ABC, abstractmethod
from typing import List, Any

class Tracking(ABC):

    @abstractmethod
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Prepare input image for model inference."""
        pass

    @abstractmethod
    def _postprocess_yolo_results(self, results: Any) -> np.ndarray:
        """Convert raw YOLO output to structured tracking results."""
        pass

    @abstractmethod
    def predict(self, inputs: List[np.ndarray]) -> List[np.ndarray]:
        """Run tracking inference on a batch of frames."""
        pass

    @abstractmethod
    def reset(self):
        """Reset internal tracker or model state."""
        pass


class TrackingService(Tracking):
    def __init__(self,
                 model_path: str = config.YOLO_MODELS,
                 image_size: int = config.IMAGE_SIZE,
                 conf_thresh: float = config.CONF_THRESH,
                 iou_thresh: float = config.IOU_THRESH,
                 keypoint_thresh: float = config.KEYPOINT_THRESH,
                 persist: bool = config.PERSIST,
                 stream: bool = config.STREAM,
                 verbose: bool = config.VERBOSE):
        # Initialize BaseModel with dummy endpoints since we're not using HTTP
        print("Initialize Tracking service")

        self.image_size = image_size
        self.conf_thresh = conf_thresh
        self.iou_thresh = iou_thresh
        self.keypoint_thresh = keypoint_thresh
        self.persist = persist
        self.stream = stream
        self.verbose = verbose
        self.model_path = model_path

        # Initialize YOLO model
        self.model = YOLO(self.model_path)

        # Override status to True since we're not using HTTP healthcheck
        self.status = True

        # FPS monitoring is handled in BaseModel automatically via class name


    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for YOLO inference"""
        # Convert BGR to RGB if needed
        if len(image.shape) == 3 and image.shape[2] == 3:
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        return image

    def _postprocess_yolo_results(self, results: Any) -> np.ndarray:
        detections = results[0]

        if detections.boxes is None or len(detections.boxes) == 0:
            return np.array([]), np.array([]), np.array([]), np.array([])

        bboxes = detections.boxes.xyxy.cpu().numpy().astype(np.float64)

        scores = detections.boxes.conf.cpu().numpy().astype(np.float64)

        if self.persist and hasattr(detections.boxes, 'id') and detections.boxes.id is not None:
            # Use actual tracking IDs when persist=True and tracking is available
            track_ids = detections.boxes.id.cpu().numpy().astype(np.float64)
        else:
            # When persist=False or no tracking IDs available, set all to -1
            track_ids = np.full(len(bboxes), -1, dtype=np.float64)

        # Extract keypoints if available
        keypoints = np.array([])
        if hasattr(detections, 'keypoints') and detections.keypoints is not None:
            # Shape: (N, 17, 3) -> (N, 51)
            kpts = detections.keypoints.data.cpu().numpy().astype(np.float64)

            # Filter keypoints based on visibility threshold
            filtered_kpts = []
            for person_kpts in kpts:
                person_filtered = []
                for kpt in person_kpts:
                    x, y, visibility = kpt
                    if visibility >= self.keypoint_thresh:
                        person_filtered.extend([float(x), float(y), float(visibility)])
                    else:
                        person_filtered.extend([-1.0, -1.0, 0.0])
                filtered_kpts.append(person_filtered)

            keypoints = np.array(filtered_kpts, dtype=np.float64)

        # Filter by confidence threshold and valid tracking IDs
        valid_indices = scores >= self.conf_thresh

        # When tracking is enabled, also filter out None tracking IDs
        if self.persist and len(track_ids) > 0:
            # Filter out detections with None/NaN tracking IDs
            valid_track_indices = ~np.isnan(track_ids) & (track_ids >= 0)
            valid_indices = valid_indices & valid_track_indices

        bboxes = bboxes[valid_indices]
        scores = scores[valid_indices]
        track_ids = track_ids[valid_indices]
        if len(keypoints) > 0:
            keypoints = keypoints[valid_indices]

        return bboxes, scores, track_ids, keypoints


    def predict(self, inputs: List[np.ndarray]) -> List[np.ndarray]:
        """Run tracking inference on a batch of frames."""
        try:
            results = []

            for image in inputs:
                # Preprocess image
                processed_image = self._preprocess_image(image)

                # Run YOLO tracking or detection based on persist setting
                if self.persist:
                    yolo_results = self.model.track(
                        processed_image,
                        conf=self.conf_thresh,
                        iou=self.iou_thresh,
                        persist=self.persist,
                        stream=self.stream,
                        verbose=self.verbose,
                        classes=[0],
                        tracker=config.TRACKER
                    )
                else:
                    # Use detection only, no tracking
                    yolo_results = self.model(
                        processed_image,
                        conf=self.conf_thresh,
                        iou=self.iou_thresh,
                        verbose=False
                    )

                yolo_results = list(yolo_results)

                # Postprocess YOLO results
                bboxes, scores, track_ids, keypoints = self._postprocess_yolo_results(yolo_results)

                # Format results
                if len(bboxes) > 0:
                    # Reshape components
                    bboxes = bboxes.reshape(-1, 4)
                    scores = scores.reshape(-1, 1)
                    track_ids = track_ids.reshape(-1, 1)

                    # Handle keypoints
                    if len(keypoints) > 0:
                        keypoints = keypoints.reshape(-1, 51)
                    else:
                        keypoints = np.zeros((len(bboxes), 51), dtype=np.float64)

                    # Concatenate results: [bbox(4), score(1), track_id(1), keypoints(51)]
                    tracking_result = np.concatenate((bboxes, scores, track_ids, keypoints), axis=1).astype(np.float64)
                else:
                    # No detections
                    tracking_result = np.array([]).reshape(0, 57).astype(np.float64)

                results.append(tracking_result)

            return results

        except Exception as e:
            raise e

    def reset(self):
        """Reset the tracker state"""
        if self.persist:
            self.model = YOLO(self.model_path)