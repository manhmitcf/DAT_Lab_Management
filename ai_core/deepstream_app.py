import os
import sys
import queue
import threading
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

    def background_publisher(self) -> None:
        """Background thread to publish frame data synchronously to network limits."""
        logger.info("Background publisher thread started.")
        while True:
            try:
                frame_data = self.frame_data_queue.get()
                if frame_data is None:
                    break
                self.result_publisher.send_frame(frame_data)
            except Exception as e:
                logger.error(f"Error publishing frame data: {e}")

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

    def build_pipeline(self) -> None:
        """Creates and links the entire GStreamer DeepStream network pipeline."""
        logger.info("Creating GStreamer Pipeline...")
        self.pipeline = Gst.Pipeline()

        logger.info(f"Using V4L2 Camera Source: {self.video_source}")
        source = Gst.ElementFactory.make("v4l2src", "source")
        source.set_property("device", self.video_source)
        source.set_property("io-mode", 2)
        
        caps_v4l2src = Gst.ElementFactory.make("capsfilter", "v4l2src_caps")
        caps_v4l2src.set_property("caps", Gst.Caps.from_string("image/jpeg,width=1920,height=1080,framerate=30/1"))
        jpegdec = Gst.ElementFactory.make("nvjpegdec", "jpeg-decoder")

        streammux = Gst.ElementFactory.make("nvstreammux", "stream-muxer")
        streammux.set_property("width", 1920)
        streammux.set_property("height", 1080)
        streammux.set_property("batch-size", 1)
        streammux.set_property("batched-push-timeout", 40000)

        pgie = Gst.ElementFactory.make("nvinfer", "primary-inference")
        pgie_config = os.getenv("PGIE_CONFIG_PATH", "deploy/DeepStream/config_infer_primary_yolox.txt")
        pgie.set_property("config-file-path", pgie_config)

        tracker = Gst.ElementFactory.make("nvtracker", "tracker")
        tracker_lib = os.getenv("TRACKER_LIB_PATH", "/workspace/ai_core/deploy/OCSort/cpp/build/libnvds_ocsort.so")
        tracker.set_property("ll-lib-file", tracker_lib)
        # Note: 'enable-batch-process' is deprecated in DeepStream 7.0 and removed from nvtracker

        nvvidconv = Gst.ElementFactory.make("nvvideoconvert", "convertor")
        nvosd = Gst.ElementFactory.make("nvdsosd", "onscreendisplay")

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

        udpsink = Gst.ElementFactory.make("udpsink", "udp-sink")
        udpsink.set_property("host", self.janus_ip)
        udpsink.set_property("port", self.janus_port)
        udpsink.set_property("async", False)
        udpsink.set_property("sync", False)

        elements = [source, caps_v4l2src, jpegdec, streammux, pgie, tracker, nvvidconv, nvosd, encoder, h264parse, rtppay, udpsink]

        for elem in elements:
            if not elem:
                logger.error("Failed to create pipeline elements.")
                sys.exit(1)
            self.pipeline.add(elem)

        source.link(caps_v4l2src)
        caps_v4l2src.link(jpegdec)
        sinkpad = streammux.get_request_pad("sink_0")
        srcpad = jpegdec.get_static_pad("src")
        srcpad.link(sinkpad)

        streammux.link(pgie)
        pgie.link(tracker)
        tracker.link(nvvidconv)
        nvvidconv.link(nvosd)
        nvosd.link(encoder)
        encoder.link(h264parse)
        h264parse.link(rtppay)
        rtppay.link(udpsink)

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
                    pad_ptr = hash(tracker_src_pad)
                    cpp_probe_service.attach_probe(pad_ptr)
                    logger.success("C++ Counting & Mapping Probe successfully attached to Tracker src pad.")
        except Exception as e:
            logger.error(f"Could not link C++ probe natively: {e}")

    def run(self) -> None:
        """Initializes and runs the entire DeepStream + Django integrated application."""
        check_and_convert_models()
        Gst.init(None)

        logger.info(f"Configuring WebRTC UDP Sink to {self.janus_ip}:{self.janus_port}")

        self.pub_thread = threading.Thread(target=self.background_publisher, daemon=True)
        self.pub_thread.start()
        
        self.settings_sub = SettingsSubscriber(
            on_mapping_update=self.handle_mapping_update,
            on_counting_update=self.handle_counting_update
        )
        self.settings_sub.start()

        self.build_pipeline()

        logger.info("Starting pipeline")
        self.pipeline.set_state(Gst.State.PLAYING)

        try:
            self.loop = GLib.MainLoop()
            self.loop.run()
        except KeyboardInterrupt:
            logger.warning("Pipeline interrupted by user.")
        finally:
            self.pipeline.set_state(Gst.State.NULL)
            self.settings_sub.stop()
            self.frame_data_queue.put(None)
            self.pub_thread.join()

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
