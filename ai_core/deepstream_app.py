import os
import sys
import glob
import time
import queue
import threading
import json
from loguru import logger

from dotenv import load_dotenv

load_dotenv()

try:
    import pyds
except ImportError:
    logger.warning("pyds module not found. This must run on a Jetson device with DeepStream.")
    pyds = None

import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib

from services.backend_gateway import ResultPublisher, SettingsSubscriber
from services.cpp_probe_service import cpp_probe_service
from config.data_config import MappingConfig, CountingConfig

# Import extracted pipeline logic
from pipeline.model_converter import check_and_convert_models
from pipeline.osd_probe import OSDProbeHandler

class DeepStreamApp:
    """
    Main DeepStream Application integrating GStreamer Pipeline, WebRTC Streaming,
    and C++ Probe bindings for high performance tracking and mapping.
    """
    
    def __init__(self):
        self.frame_data_queue = queue.Queue(maxsize=100)
        self.result_publisher = ResultPublisher()
        self.mapping_config = MappingConfig("config/mapping_config.json")
        self.counting_config = CountingConfig(json_path="config/counting_config.json")
        
        # Initialize the extracted OSD Probe Handler
        self.osd_probe_handler = OSDProbeHandler(self.frame_data_queue, self.mapping_config, self.counting_config)
        
        self.pub_thread = None
        self.settings_sub = None
        self.pipeline = None
        self.loop = None
        
        self.janus_ip = os.getenv("JANUS_SERVER_IP", "127.0.0.1")
        self.janus_port = int(os.getenv("JANUS_UDP_PORT", "8000"))
        self.video_source = os.getenv("INPUT_VIDEO_SOURCE", "/dev/video0")

    def preflight_check(self) -> bool:
        """Runs essential diagnostic checks before starting the pipeline."""
        success = True
        logger.info("━" * 60)
        logger.info("[DIAGNOSTIC] Checking system readiness...")
        logger.info("━" * 60)

        # 1. Check Camera
        if os.path.exists(self.video_source):
            logger.success(f"[CAMERA] Found source device: {self.video_source}")
        else:
            logger.error(f"[CAMERA] Device NOT FOUND: {self.video_source}. Pipeline will fail.")
            success = False

        # 2. Check Critical Files
        files_to_check = {
            "YOLOX Engine": "pretrained/ocsort_x_mot20_fp16.engine",
            "PGIE Config": os.getenv("PGIE_CONFIG_PATH", "deploy/DeepStream/config_infer_primary_yolox.txt"),
            "OCSort Lib": "/workspace/ai_core/deploy/OCSort/cpp/build/libnvds_ocsort.so",
            "Parser Lib": "deploy/DeepStream/libnvdsinfer_custom_impl_YoloX.so",
            "Mapping Config": "config/mapping_config.json",
            "Counting Config": "config/counting_config.json",
            ".env File": "config/.env"
        }
        for name, path in files_to_check.items():
            if os.path.exists(path):
                logger.success(f"[FILE] {name:15} | Found: {path}")
            else:
                logger.error(f"[FILE] {name:15} | NOT FOUND: {path}")
                success = False

        # 3. Check pyds
        if pyds:
            logger.success("[PYTHON] pyds bindings loaded successfully.")
        else:
            logger.warning("[PYTHON] pyds NOT found. OSD logic will be skipped.")

        # 4. Check Environment
        required_env = ["RESULTS_WS_URL", "MAPPING_SETTINGS_WS_URL", "COUNTING_SETTINGS_WS_URL"]
        for env in required_env:
            if os.getenv(env):
                logger.success(f"[ENV] {env:25} | Set")
            else:
                logger.warning(f"[ENV] {env:25} | NOT SET")

        logger.info("━" * 60)
        if success:
            logger.success("[DIAGNOSTIC] Pre-flight checks passed.")
        else:
            logger.warning("[DIAGNOSTIC] Pre-flight checks failed. Attempting to start anyway...")
        logger.info("━" * 60)
        return success

    def background_publisher(self) -> None:
        """Background thread to publish frame data synchronously to network limits."""
        logger.info("[Publisher] Background publisher thread started. Waiting for frames...")
        frames_sent = 0
        last_log_time = time.time()
        while True:
            try:
                # Use timeout to detect if pipeline is stalled
                frame_data = self.frame_data_queue.get(timeout=10.0)
                if frame_data is None:
                    logger.info("[Publisher] Received shutdown signal. Stopping.")
                    break
                
                self.result_publisher.send_frame(frame_data)
                frames_sent += 1
                if frames_sent == 1:
                    logger.success(f"[Publisher] First frame published successfully to {os.getenv('RESULTS_WS_URL')}")
                elif frames_sent % 300 == 0:
                    logger.debug(f"[Publisher] {frames_sent} frames published so far.")
            except queue.Empty:
                if time.time() - last_log_time > 30:
                    logger.warning("[Publisher] No data received from pipeline for 30 seconds. Is camera streaming?")
                    last_log_time = time.time()
            except Exception as e:
                logger.error(f"[Publisher] Error publishing frame data: {e}")

    def handle_mapping_update(self, data: dict) -> None:
        """Callbacks from Django defining Homography configuration updates."""
        logger.info("[WebSocket] Received MAPPING update. Pushing to C++.")
        try:
            correspondences = data.get("correspondences", [])
            cam_pts = [(float(i.get("camera")[0]), float(i.get("camera")[1])) for i in correspondences]
            map_pts = [(float(i.get("map")[0]), float(i.get("map")[1])) for i in correspondences]
            
            img_sz = data.get("image_size", {})
            cam_sz = (int(img_sz.get("width", 1920)), int(img_sz.get("height", 1080)))
            
            m_sz = data.get("map_size", {})
            map_sz = (int(m_sz.get("width", 723)), int(m_sz.get("height", 1266)))
            
            self.mapping_config.map_size = map_sz
            cpp_probe_service.update_mapping(cam_pts, map_pts, map_sz)
        except Exception as e:
            logger.error(f"Error handling mapping update: {e}")

    def handle_counting_update(self, data: dict) -> None:
        """Callbacks from Django defining Line Crossing configuration updates."""
        logger.info("[WebSocket] Received COUNTING update. Pushing to C++.")
        try:
            start = tuple(data.get("line_start"))
            end = tuple(data.get("line_end"))
            inside = tuple(data.get("inside_point"))
            margin = data.get("crossing_margin", 10)
            cpp_probe_service.update_counting(start, end, inside, margin)
            
            if "info_threshold" in data:
                self.osd_probe_handler.info_threshold = data["info_threshold"]
            if "warning_threshold" in data:
                self.osd_probe_handler.warning_threshold = data["warning_threshold"]
            if "critical_threshold" in data:
                self.osd_probe_handler.critical_threshold = data["critical_threshold"]
        except Exception as e:
            logger.error(f"Error handling counting update: {e}")

    def load_initial_configs(self):
        """Loads counting and mapping settings from local JSON if available."""
        # 1. Counting Config
        counting_path = "config/counting_config.json"
        if os.path.exists(counting_path):
            try:
                with open(counting_path, 'r') as f:
                    cfg = json.load(f)
                self.handle_counting_update(cfg)
                logger.info(f"[CONFIG] Initial Counting settings loaded from {counting_path}")
            except Exception as e:
                logger.error(f"[CONFIG] Failed to load initial counting config: {e}")

        # 2. Mapping Config
        mapping_path = "config/mapping_config.json"
        if os.path.exists(mapping_path):
            try:
                with open(mapping_path, 'r') as f:
                    cfg = json.load(f)
                self.handle_mapping_update(cfg)
                logger.info(f"[CONFIG] Initial Mapping settings loaded from {mapping_path}")
            except Exception as e:
                logger.error(f"[CONFIG] Failed to load initial mapping config: {e}")

    def build_pipeline(self) -> None:
        """Creates and links the entire GStreamer DeepStream network pipeline."""
        logger.info("[PIPELINE] Initializing GStreamer elements...")
        self.pipeline = Gst.Pipeline()

        is_live = False
        if self.video_source.startswith("/dev/video"):
            is_live = True
            logger.info(f"Using V4L2 Camera Source: {self.video_source}")
            source = Gst.ElementFactory.make("v4l2src", "source")
            source.set_property("device", self.video_source)
            source.set_property("io-mode", 2)
            source.set_property("do-timestamp", True)
            
            caps_v4l2src = Gst.ElementFactory.make("capsfilter", "v4l2src_caps")
            caps_v4l2src.set_property("caps", Gst.Caps.from_string("image/jpeg,width=1920,height=1080,framerate=30/1"))
            
            cam_queue = Gst.ElementFactory.make("queue", "camera-queue")
            cam_queue.set_property("max-size-buffers", 1)
            cam_queue.set_property("leaky", 2)  # leaky=downstream

            jpegparse = Gst.ElementFactory.make("jpegparse", "jpeg-parser")
            jpegdec = Gst.ElementFactory.make("nvv4l2decoder", "jpeg-decoder")
            jpegdec.set_property("mjpeg", 1)  # Use hardware MJPEG decoding
        else:
            uri = self.video_source
            if not uri.startswith("rtsp://") and not uri.startswith("http://") and not uri.startswith("file://"):
                uri = f"file://{os.path.abspath(uri)}"
            logger.info(f"Using URI Source: {uri}")
            source = Gst.ElementFactory.make("uridecodebin", "source")
            source.set_property("uri", uri)
            caps_v4l2src = None
            cam_queue = None
            jpegparse = None
            jpegdec = None

        # Force NV12 conversion before nvstreammux to prevent jpegdec from stalling
        nvvidconv_src = Gst.ElementFactory.make("nvvideoconvert", "convertor_src")
        caps_vidconv_src = Gst.ElementFactory.make("capsfilter", "caps_vidconv_src")
        caps_vidconv_src.set_property("caps", Gst.Caps.from_string("video/x-raw(memory:NVMM),format=NV12"))

        streammux = Gst.ElementFactory.make("nvstreammux", "stream-muxer")
        streammux.set_property("width", 1920)
        streammux.set_property("height", 1080)
        streammux.set_property("batch-size", 1)
        streammux.set_property("batched-push-timeout", 33000)
        if is_live:
            streammux.set_property("live-source", 1)  # CRITICAL for USB Cameras

        pgie = Gst.ElementFactory.make("nvinfer", "primary-inference")
        pgie_config = os.getenv("PGIE_CONFIG_PATH", "deploy/DeepStream/config_infer_primary_yolox.txt")
        pgie.set_property("config-file-path", pgie_config)
        pgie.set_property("unique-id", 1)

        tracker = Gst.ElementFactory.make("nvtracker", "tracker")
        tracker_lib = os.getenv("TRACKER_LIB_PATH", "/workspace/ai_core/deploy/OCSort/cpp/build/libnvds_ocsort.so")
        tracker.set_property("ll-lib-file", tracker_lib)
        tracker.set_property("ll-config-file", os.getenv("TRACKER_CONFIG_PATH", "deploy/DeepStream/config_tracker_ocsort.txt"))
        tracker.set_property("tracker-width", 640)
        tracker.set_property("tracker-height", 640)

        nvvidconv = Gst.ElementFactory.make("nvvideoconvert", "convertor")
        nvosd = Gst.ElementFactory.make("nvdsosd", "onscreendisplay")

        # Must convert RGBA out of nvosd to I420 for nvv4l2h264enc
        nvvidconv2 = Gst.ElementFactory.make("nvvideoconvert", "convertor2")
        caps_enc = Gst.ElementFactory.make("capsfilter", "caps_enc")
        caps_enc.set_property("caps", Gst.Caps.from_string("video/x-raw(memory:NVMM),format=I420"))

        encoder = Gst.ElementFactory.make("nvv4l2h264enc", "h264-encoder")
        encoder.set_property("bitrate", int(os.getenv("VIDEO_BITRATE", "1200000")))
        encoder.set_property("profile", 0)
        encoder.set_property("control-rate", 1)
        encoder.set_property("preset-level", 1)
        encoder.set_property("maxperf-enable", 1)
        encoder.set_property("insert-sps-pps", 1)
        encoder.set_property("iframeinterval", 30)
        
        h264parse = Gst.ElementFactory.make("h264parse", "h264-parser")
        h264parse.set_property("config-interval", 1)

        rtppay = Gst.ElementFactory.make("rtph264pay", "rtp-payer")
        rtppay.set_property("pt", 96)
        rtppay.set_property("aggregate-mode", 1)  # 1 = zero-latency

        udpsink = Gst.ElementFactory.make("udpsink", "udp-sink")
        udpsink.set_property("host", self.janus_ip)
        udpsink.set_property("port", self.janus_port)
        udpsink.set_property("async", False)
        udpsink.set_property("sync", False)

        if is_live:
            elements = [source, caps_v4l2src, cam_queue, jpegparse, jpegdec, nvvidconv_src, caps_vidconv_src, streammux, pgie, tracker, nvvidconv, nvosd, nvvidconv2, caps_enc, encoder, h264parse, rtppay, udpsink]
        else:
            elements = [source, nvvidconv_src, caps_vidconv_src, streammux, pgie, tracker, nvvidconv, nvosd, nvvidconv2, caps_enc, encoder, h264parse, rtppay, udpsink]

        for elem in elements:
            if not elem:
                logger.error("[PIPELINE] Failed to create element.")
                sys.exit(1)
            self.pipeline.add(elem)

        def _link(e1, e2):
            if not e1.link(e2):
                logger.error(f"[PIPELINE] Failed to link {e1.get_name()} → {e2.get_name()}")
                sys.exit(1)
            else:
                logger.debug(f"[PIPELINE] Linked {e1.get_name()} → {e2.get_name()}")

        if is_live:
            _link(source, caps_v4l2src)
            _link(caps_v4l2src, cam_queue)
            _link(cam_queue, jpegparse)
            _link(jpegparse, jpegdec)
            _link(jpegdec, nvvidconv_src)
        else:
            def cb_newpad(decodebin, decoder_src_pad, data):
                logger.debug(f"[PIPELINE] uridecodebin linked to {data.get_name()}")
                caps = decoder_src_pad.get_current_caps()
                if not caps:
                    caps = decoder_src_pad.query_caps()
                gststruct = caps.get_structure(0)
                gstname = gststruct.get_name()
                if gstname.find("video") != -1:
                    sink_pad = data.get_static_pad("sink")
                    if not sink_pad.is_linked():
                        decoder_src_pad.link(sink_pad)
            source.connect("pad-added", cb_newpad, nvvidconv_src)

        _link(nvvidconv_src, caps_vidconv_src)
        
        sinkpad = streammux.get_request_pad("sink_0")
        srcpad = caps_vidconv_src.get_static_pad("src")
        if not srcpad or not sinkpad or srcpad.link(sinkpad) != Gst.PadLinkReturn.OK:
            logger.error("[PIPELINE] Failed to link caps_vidconv_src → streammux sinkpad")
            sys.exit(1)
        else:
            logger.debug("[PIPELINE] Linked caps_vidconv_src → streammux:sink_0")

        _link(streammux, pgie)
        _link(pgie, tracker)
        _link(tracker, nvvidconv)
        _link(nvvidconv, nvosd)
        _link(nvosd, nvvidconv2)
        _link(nvvidconv2, caps_enc)
        _link(caps_enc, encoder)
        _link(encoder, h264parse)
        _link(h264parse, rtppay)
        _link(rtppay, udpsink)

        logger.success("[PIPELINE] All elements created and linked successfully.")

        # Connect Python Pad Probe from the extracted class
        osd_sink_pad = nvosd.get_static_pad("sink")
        if osd_sink_pad:
            osd_sink_pad.add_probe(Gst.PadProbeType.BUFFER, self.osd_probe_handler.osd_sink_pad_buffer_probe, 0)
        else:
            logger.error("Unable to get sink pad of nvosd")

        try:
            if cpp_probe_service.is_available:
                tracker_src_pad = tracker.get_static_pad("src")
                if tracker_src_pad:
                    pad_ptr = pyds.get_ptr(tracker_src_pad)
                    cpp_probe_service.attach_probe(pad_ptr)
                    logger.success("C++ Counting & Mapping Probe successfully attached to Tracker src pad.")
        except Exception as e:
            logger.error(f"Could not link C++ probe natively: {e}")

    def run(self) -> None:
        """Initializes and runs the entire DeepStream + Django integrated application."""
        check_and_convert_models()
        Gst.init(None)

        self.preflight_check()  # ← Run all diagnostics before touching GStreamer
        
        # Load saved settings into C++ core BEFORE start
        self.load_initial_configs()

        logger.info(f"[Pipeline] Configuring WebRTC UDP Sink → {self.janus_ip}:{self.janus_port}")

        self.pub_thread = threading.Thread(target=self.background_publisher, daemon=True)
        self.pub_thread.start()
        
        self.settings_sub = SettingsSubscriber(
            on_mapping_update=self.handle_mapping_update,
            on_counting_update=self.handle_counting_update
        )
        self.settings_sub.start()
        logger.info("[Pipeline] WebSocket Settings Subscriber started.")

        self.build_pipeline()

        logger.info("[Pipeline] Setting pipeline to PLAYING state...")
        self.pipeline.set_state(Gst.State.PLAYING)
        logger.success("[Pipeline] Pipeline is now PLAYING. Processing frames from camera.")

        try:
            self.loop = GLib.MainLoop()
            self.loop.run()
        except KeyboardInterrupt:
            logger.warning("[Pipeline] Interrupted by user (KeyboardInterrupt). Shutting down...")
        finally:
            logger.info("[Pipeline] Shutting down pipeline and releasing resources...")
            self.pipeline.set_state(Gst.State.NULL)
            self.settings_sub.stop()
            self.frame_data_queue.put(None)
            self.pub_thread.join()
            logger.info("[Pipeline] Shutdown complete.")

if __name__ == "__main__":
    import sys
    
    logger.remove()
    logger.add(
        sys.stdout, 
        colorize=True, 
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
    )
    
    os.makedirs("logs", exist_ok=True)
    logger.add("logs/app.log", rotation="50 MB", retention=5, level="INFO")
    
    logger.info("DeepStream AI Application Initializing...")
    app = DeepStreamApp()
    app.run()
