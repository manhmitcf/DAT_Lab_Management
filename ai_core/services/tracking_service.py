from config import configuration as config
# from ultralytics import YOLO
import cv2
import numpy as np
from abc import ABC, abstractmethod
from typing import List, Any
import os.path as osp
import cv2
import torch
import tensorrt as trt
import pycuda.driver as cuda
import pycuda.autoinit
from numba import njit
from exps.yolox_x_mix_mot20_ch import Exp
from loguru import logger
from yolox.data.data_augment import preproc
from yolox.utils import fuse_model, get_model_info, postprocess
from trackers.ocsort_tracker.ocsort import OCSort
from trackers.tracking_utils.timer import Timer


@njit(fastmath=True)
def fast_preprocess(img, mean, std):
    h, w, c = img.shape
    res = np.empty((c, h, w), dtype=np.float32)
    for i in range(h):
        for j in range(w):
            res[0, i, j] = (img[i, j, 0] / 255.0 - mean[0]) / std[0]
            res[1, i, j] = (img[i, j, 1] / 255.0 - mean[1]) / std[1]
            res[2, i, j] = (img[i, j, 2] / 255.0 - mean[2]) / std[2]
    return res

class Predictor(object):
    def __init__(
            self,
            model,
            exp,
            trt_file=None,
            decoder=None,
            device=torch.device("cuda"),
            fp16=False
    ):
        self.logger = trt.Logger(trt.Logger.INFO)
        self.confthre = exp.test_conf
        self.nmsthre = exp.nmsthre
        self.input_shape = exp.test_size
        
        engine_path = trt_file
        if not engine_path:
            raise ValueError("trt_file must be provided for TRT Predictor!")
            
        engine_bytes = None
        try:
            import torch
            ckpt = torch.load(engine_path, map_location="cpu")
            if isinstance(ckpt, dict) and 'engine' in ckpt:
                engine_bytes = bytes(ckpt['engine'])
            elif isinstance(ckpt, bytearray):
                engine_bytes = bytes(ckpt)
        except Exception:
            pass
            
        if engine_bytes is None:
            with open(engine_path, "rb") as f:
                engine_bytes = f.read()
                
        with trt.Runtime(self.logger) as runtime:
            self.engine = runtime.deserialize_cuda_engine(engine_bytes)
            
        if self.engine is None:
            raise RuntimeError("Engine deserialization failed! Please check if your .trt file is valid.")
            
        self.context = self.engine.create_execution_context()
        self.inputs, self.outputs, self.bindings, self.stream = self.allocate_buffers(self.engine)
        self.mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        self.std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    def allocate_buffers(self, engine):
        inputs, outputs, bindings = [], [], []
        stream = cuda.Stream()
        for binding in engine:
            shape = engine.get_binding_shape(binding)
            size = trt.volume(shape)
            dtype = trt.nptype(engine.get_binding_dtype(binding))
            host_mem = cuda.pagelocked_empty(size, dtype)
            device_mem = cuda.mem_alloc(host_mem.nbytes)
            bindings.append(int(device_mem))
            if engine.binding_is_input(binding):
                inputs.append({'host': host_mem, 'device': device_mem})
            else:
                outputs.append({'host': host_mem, 'device': device_mem})
        return inputs, outputs, bindings, stream

    def preproc(self, img, input_size):
        padded_img = np.ones((input_size[0], input_size[1], 3), dtype=np.uint8) * 114
        r = min(input_size[0] / img.shape[0], input_size[1] / img.shape[1])
        resized_img = cv2.resize(img, (int(img.shape[1] * r), int(img.shape[0] * r)), interpolation=cv2.INTER_LINEAR)
        padded_img[: int(img.shape[0] * r), : int(img.shape[1] * r)] = resized_img
        return fast_preprocess(padded_img, self.mean, self.std), r

    def inference(self, frame, timer):
        img_info = {"height": frame.shape[0], "width": frame.shape[1], "raw_img": frame}
        img_pre, ratio = self.preproc(frame, self.input_shape)
        img_info["ratio"] = ratio
        np.copyto(self.inputs[0]['host'], img_pre.ravel())
        timer.tic()
        cuda.memcpy_htod_async(self.inputs[0]['device'], self.inputs[0]['host'], self.stream)
        self.context.execute_async_v2(bindings=self.bindings, stream_handle=self.stream.handle)
        cuda.memcpy_dtoh_async(self.outputs[0]['host'], self.outputs[0]['device'], self.stream)
        self.stream.synchronize()
        output = self.outputs[0]['host'].reshape(self.engine.get_binding_shape(1))
        from yolox.utils import multiclass_nms, demo_postprocess
        predictions = demo_postprocess(output, self.input_shape, p6=False)[0]
        if predictions is None: return [None], img_info
        boxes_xyxy = np.ones_like(predictions[:, :4])
        boxes_xyxy[:, 0] = (predictions[:, 0] - predictions[:, 2]/2.)
        boxes_xyxy[:, 1] = (predictions[:, 1] - predictions[:, 3]/2.)
        boxes_xyxy[:, 2] = (predictions[:, 0] + predictions[:, 2]/2.)
        boxes_xyxy[:, 3] = (predictions[:, 1] + predictions[:, 3]/2.)
        dets = multiclass_nms(boxes_xyxy, predictions[:, 4:5] * predictions[:, 5:], nms_thr=self.nmsthre, score_thr=self.confthre)
        
        result = dets[:, :-1] if dets is not None else None
        return [result], img_info

class YOLOX:
    def __init__(self, args):
        self.args = args
        self.exp = Exp()
        self.setup_parameters()
        self.model = self.exp.get_model().to(self.args.device)
        logger.info("Model Summary: {}".format(get_model_info(self.model, self.exp.test_size)))
        self.model.eval()
        self.decoder = None

        self.setup_model()

    def setup_model(self):
        if not self.args.trt:  # nếu không dùng TensorRT, load checkpoint bình thường
            ckpt_file = self.args.ckpt
            logger.info("loading checkpoint")
            ckpt = torch.load(ckpt_file, map_location="cpu")
            # load the model state dict
            self.model.load_state_dict(ckpt["model"])
            logger.info("loaded checkpoint done.")

        if self.args.fuse:
            logger.info("\tFusing model...")
            self.model = fuse_model(self.model)

        if self.args.fp16:
            self.model = self.model.half()  # to FP16

        if self.args.trt:
            assert not self.args.fuse, "TensorRT model is not support model fusing!"
            trt_file = self.args.trt_file
            assert osp.exists(
                trt_file
            ), "TensorRT model is not found!\n Run python3 tools/trt.py first!"
            self.model.head.decode_in_inference = False
            self.decoder = self.model.head.decode_outputs
            logger.info("Using TensorRT to inference")
        else:
            self.args.trt_file = None
            self.decoder = None

    def setup_parameters(self):
        if self.args.trt:
            self.args.device = "gpu"
        self.args.device = torch.device("cuda" if self.args.device == "gpu" else "cpu")

        if self.args.conf is not None:
            self.exp.test_conf = self.args.conf
        if self.args.nms is not None:
            self.exp.nmsthre = self.args.nms
        if self.args.tsize is not None:
            self.exp.test_size = (self.args.tsize, self.args.tsize)

        logger.info("Args: {}".format(self.args))


class TrackingService:
    def __init__(self, args):
        self.yolo = YOLOX(args=args)

        self.predictor = Predictor(self.yolo.model,
                                   self.yolo.exp,
                                   self.yolo.args.trt_file,
                                   self.yolo.decoder,
                                   self.yolo.args.device,
                                   self.yolo.args.fp16)

        self.tracker = OCSort(det_thresh=self.yolo.args.track_thresh,
                              iou_threshold=self.yolo.args.iou_thresh,
                              use_byte=self.yolo.args.use_byte)

        self.timer = Timer()

    def predict(self, frame_id, frame, box_type="xyxy"):

        if frame_id % 30 == 0:
            logger.info('Processing frame {} ({:.2f} fps)'.format(frame_id, 1. / max(1e-5, self.timer.average_time)))

        outputs, img_info = self.predictor.inference(frame, self.timer)
        bboxes = []
        track_ids = []

        if outputs[0] is not None:

            targets = self.tracker.update(output_results=outputs[0],
                                         img_info=[img_info['height'],
                                                   img_info['width']],
                                         img_size=self.yolo.exp.test_size)

            for t in targets:
                tlwh = [t[0], t[1], t[2] - t[0], t[3] - t[1]]
                xyxy = [t[0], t[1], t[2], t[3]]
                tid = t[4]
                vertical = tlwh[2] / tlwh[3] > self.yolo.args.aspect_ratio_thresh
                if tlwh[2] * tlwh[3] > self.yolo.args.min_box_area and not vertical:
                    bboxes.append(xyxy if box_type == "xyxy" else tlwh)
                    track_ids.append(tid)
            self.timer.toc()

        return bboxes, track_ids, self.timer.average_time


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


class TrackingUltralytics(Tracking):
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