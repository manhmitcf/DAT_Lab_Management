import os
import sys
import time
import queue
import threading
from datetime import datetime, timezone
from loguru import logger
import ctypes
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

from schemas.schemas import FrameData, ObjectDetection
from services.backend_gateway import ResultPublisher, SettingsSubscriber
from services.cpp_probe_service import cpp_probe_service, CustomMappingData
from services.mapping_service import MappingService
from config.data_config import MappingConfig

# Global queues and services
frame_data_queue = queue.Queue(maxsize=100)
result_publisher = ResultPublisher()
mapping_service = MappingService(MappingConfig("config/mapping_config.json"))

def background_publisher():
    logger.info("Background publisher thread started.")
    while True:
        try:
            frame_data = frame_data_queue.get()
            if frame_data is None:
                break
            result_publisher.send_frame(frame_data)
        except Exception as e:
            logger.error(f"Error publishing frame data: {e}")

def osd_sink_pad_buffer_probe(pad, info, u_data):
    if not pyds:
        return Gst.PadProbeReturn.OK

    gst_buffer = info.get_buffer()
    if not gst_buffer:
        logger.error("Unable to get GstBuffer ")
        return Gst.PadProbeReturn.OK

    batch_meta = pyds.gst_buffer_get_nvds_batch_meta(hash(gst_buffer))
    l_frame = batch_meta.frame_meta_list
    
    while l_frame is not None:
        try:
            frame_meta = pyds.NvDsFrameMeta.cast(l_frame.data)
        except StopIteration:
            break
        
        objects = []
        l_obj = frame_meta.obj_meta_list
        while l_obj is not None:
            try:
                obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
            except StopIteration:
                break
            
            # Extract custom mapping data from NvDsUserMeta injected by C++
            mapped_coords = None
            if obj_meta.object_id > 0:
                l_user_meta = obj_meta.obj_user_meta_list
                while l_user_meta is not None:
                    try:
                        user_meta = pyds.NvDsUserMeta.cast(l_user_meta.data)
                    except StopIteration:
                        break
                    
                    if user_meta.base_meta.meta_type == pyds.nvds_get_user_meta_type("NVDS.CUSTOM.MAPPING.META"):
                        c_data_ptr = ctypes.cast(pyds.get_ptr(user_meta.user_meta_data), ctypes.POINTER(CustomMappingData))
                        custom_data = c_data_ptr.contents
                        mapped_coords = [float(custom_data.map_x), float(custom_data.map_y)]
                        
                    try:
                        l_user_meta = l_user_meta.next
                    except StopIteration:
                        break

            if obj_meta.object_id > 0:
                rect = obj_meta.rect_params
                bbox = [rect.left, rect.top, rect.left + rect.width, rect.top + rect.height]
                
                obj_det = ObjectDetection(
                    track_id=obj_meta.object_id,
                    bbox=bbox,
                    coordinates_2D=mapped_coords
                )
                objects.append(obj_det)
                
            try:
                l_obj = l_obj.next
            except StopIteration:
                break
        
        # Get count stats from C++ shared memory
        in_cnt, out_cnt = cpp_probe_service.get_counts()
        
        # Create FrameData
        frame_data = FrameData(
            timestamp=datetime.now(timezone.utc),
            count_in=in_cnt,
            count_out=out_cnt,
            occupancy=max(0, in_cnt - out_cnt),
            alert='none',
            save_to_db=True,
            height_frame=frame_meta.source_frame_height,
            width_frame=frame_meta.source_frame_width,
            height_2D=mapping_service.map_size[1] if mapping_service.map_size else 1266,
            width_2D=mapping_service.map_size[0] if mapping_service.map_size else 723,
            objects=objects
        )
        
        if not frame_data_queue.full():
            frame_data_queue.put(frame_data)
            
        try:
            l_frame = l_frame.next
        except StopIteration:
            break
            
    return Gst.PadProbeReturn.OK

def check_and_convert_models():
    """Check if Engine and ONNX exist. If not, try to auto-convert from PTH and build Engine."""
    engine_path = os.getenv("MODEL_ENGINE_PATH", "pretrained/ocsort_x_mot20_fp16.engine")
    onnx_path = os.getenv("MODEL_ONNX_PATH", "pretrained/ocsort_x_mot20.onnx")
    pth_path = os.getenv("MODEL_PTH_PATH", "pretrained/ocsort_x_mot20.pth")
    exp_file = os.getenv("MODEL_EXP_FILE", "exps/example/mot/yolox_x_mix_det.py")
    
    # Check if we need to do anything
    if os.path.exists(engine_path):
        return

    logger.warning(f"TensorRT Engine not found at {engine_path}.")
    
    import subprocess
    if not os.path.exists(onnx_path):
        logger.warning(f"ONNX model also not found at {onnx_path}.")
        if os.path.exists(pth_path) and os.path.exists(exp_file):
            logger.info("Auto-converting PTH to ONNX...")
            cmd = ["python3", "deploy/scripts/export_onnx.py", 
                   "--output-name", onnx_path, 
                   "-f", exp_file, 
                   "-c", pth_path]
            try:
                subprocess.run(cmd, check=True)
                logger.success(f"Successfully converted PTH to ONNX at {onnx_path}")
            except subprocess.CalledProcessError as e:
                logger.error(f"Failed to convert PTH to ONNX: {e}")
                return
        else:
            logger.error("Missing .pth or exp_file for ONNX conversion.")
            return
            
    # If ONNX now exists, build engine using trtexec
    if os.path.exists(onnx_path):
        logger.info(f"Building TensorRT Engine using trtexec from {onnx_path}...")
        trtexec_cmd = [
            "/usr/src/tensorrt/bin/trtexec",
            f"--onnx={onnx_path}",
            f"--saveEngine={engine_path}",
            "--fp16",
            "--memPoolSize=workspace:4096"
        ]
        try:
            # We don't capture output because trtexec logs are useful for the user to see progress
            subprocess.run(trtexec_cmd, check=True)
            logger.success(f"Successfully built TensorRT engine at {engine_path}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to build TensorRT engine: {e}")

def main():
    check_and_convert_models()
    Gst.init(None)
    
    # Check Azure config
    janus_ip = os.getenv("JANUS_SERVER_IP", "127.0.0.1")
    janus_port = int(os.getenv("JANUS_UDP_PORT", "8000"))
    logger.info(f"Configuring WebRTC UDP Sink to {janus_ip}:{janus_port}")

    # Start the backend publisher thread
    pub_thread = threading.Thread(target=background_publisher, daemon=True)
    pub_thread.start()
    
    # Start Settings Subscriber
    def handle_mapping_update(data):
        logger.info("[WebSocket] Received MAPPING update. Pushing to C++.")
        try:
            correspondences = data.get("correspondences", [])
            cam_pts = [(float(i.get("camera")[0]), float(i.get("camera")[1])) for i in correspondences]
            map_pts = [(float(i.get("map")[0]), float(i.get("map")[1])) for i in correspondences]
            
            img_size = data.get("image_size", {})
            cam_sz = (int(img_size.get("width", 1920)), int(img_size.get("height", 1080)))
            
            m_size = data.get("map_size", {})
            map_sz = (int(m_size.get("width", 723)), int(m_size.get("height", 1266)))
            
            # Update Python mapping service (used by Probe for coordinates_2D)
            mapping_service.update_mapping(cam_pts, map_pts, cam_sz, map_sz)
            
            # Update C++ probe shared memory
            cpp_probe_service.update_mapping(cam_pts, map_pts, map_sz)
        except Exception as e:
            logger.error(f"Error handling mapping update: {e}")

    def handle_counting_update(data):
        logger.info("[WebSocket] Received COUNTING update. Pushing to C++.")
        try:
            start = tuple(data.get("line_start"))
            end = tuple(data.get("line_end"))
            inside = tuple(data.get("inside_point"))
            margin = data.get("crossing_margin", 10)
            cpp_probe_service.update_counting(start, end, inside, margin)
        except Exception as e:
            logger.error(f"Error handling counting update: {e}")

    settings_sub = SettingsSubscriber(
        on_mapping_update=handle_mapping_update,
        on_counting_update=handle_counting_update
    )
    settings_sub.start()

    logger.info("Creating GStreamer Pipeline...")
    pipeline = Gst.Pipeline()

    is_camera = False
    video_source = os.getenv("INPUT_VIDEO_SOURCE", "/dev/video0")
    
    if video_source.startswith("/dev/video"):
        logger.info(f"Using V4L2 Camera Source: {video_source}")
        is_camera = True
        source = Gst.ElementFactory.make("v4l2src", "source")
        source.set_property("device", video_source)
        source.set_property("io-mode", 2) # mmap
        
        # Camera caps: image/jpeg,width=1280,height=720,framerate=30/1
        caps_v4l2src = Gst.ElementFactory.make("capsfilter", "v4l2src_caps")
        caps_v4l2src.set_property("caps", Gst.Caps.from_string("image/jpeg,width=1280,height=720,framerate=30/1"))
        
        jpegdec = Gst.ElementFactory.make("nvjpegdec", "jpeg-decoder")
    else:
        logger.info(f"Using URI Source: {video_source}")
        source = Gst.ElementFactory.make("uridecodebin", "source")
        source.set_property("uri", video_source)

    streammux = Gst.ElementFactory.make("nvstreammux", "stream-muxer")
    streammux.set_property("width", 1280 if is_camera else 1920)
    streammux.set_property("height", 720 if is_camera else 1080)
    streammux.set_property("batch-size", 1)
    streammux.set_property("batched-push-timeout", 40000)

    pgie = Gst.ElementFactory.make("nvinfer", "primary-inference")
    pgie_config = os.getenv("PGIE_CONFIG_PATH", "deploy/DeepStream/config_infer_primary_yolox.txt")
    pgie.set_property("config-file-path", pgie_config)

    tracker = Gst.ElementFactory.make("nvtracker", "tracker")
    tracker_lib = os.getenv("TRACKER_LIB_PATH", "/workspace/ai_core/deploy/OCSort/cpp/build/libnvds_ocsort.so")
    tracker.set_property("ll-lib-file", tracker_lib)
    tracker.set_property("enable-batch-process", 1)

    nvvidconv = Gst.ElementFactory.make("nvvideoconvert", "convertor")
    nvosd = Gst.ElementFactory.make("nvdsosd", "onscreendisplay")

    # Hardcoded exactly from user's conf.txt mapping
    encoder = Gst.ElementFactory.make("nvv4l2h264enc", "h264-encoder")
    video_bitrate = int(os.getenv("VIDEO_BITRATE", "1200000"))
    encoder.set_property("bitrate", video_bitrate)
    encoder.set_property("profile", 0) # Base
    encoder.set_property("control-rate", 1)
    encoder.set_property("preset-level", 1)
    encoder.set_property("maxperf-enable", 1)
    encoder.set_property("insert-sps-pps", 1)
    encoder.set_property("iframeinterval", 30)
    
    # H264Parse before RTP
    h264parse = Gst.ElementFactory.make("h264parse", "h264-parser")
    h264parse.set_property("config-interval", 1)

    rtppay = Gst.ElementFactory.make("rtph264pay", "rtp-payer")
    rtppay.set_property("pt", 96)
    # aggregate-mode 1 = zero-latency? Wait, there is no generic string setting for it in pyds directly without integer values if it's enum, but let's try property setting
    # In C/gst-launch, aggregate-mode=zero-latency usually works, let's omit unless necessary or set generically
    
    udpsink = Gst.ElementFactory.make("udpsink", "udp-sink")
    udpsink.set_property("host", janus_ip)
    udpsink.set_property("port", janus_port)
    udpsink.set_property("async", False)
    udpsink.set_property("sync", False)

    # Add elements to pipeline
    if is_camera:
        elements = [source, caps_v4l2src, jpegdec, streammux, pgie, tracker, nvvidconv, nvosd, encoder, h264parse, rtppay, udpsink]
    else:
        elements = [source, streammux, pgie, tracker, nvvidconv, nvosd, encoder, h264parse, rtppay, udpsink]

    for elem in elements:
        if not elem:
            logger.error("Failed to create some pipeline element.")
            sys.exit(1)
        pipeline.add(elem)

    # Link elements
    if is_camera:
        source.link(caps_v4l2src)
        caps_v4l2src.link(jpegdec)
        sinkpad = streammux.get_request_pad("sink_0")
        srcpad = jpegdec.get_static_pad("src")
        srcpad.link(sinkpad)
    else:
        def cb_newpad(decodebin, decoder_src_pad, data):
            caps = decoder_src_pad.get_current_caps()
            if not caps: return
            gststruct = caps.get_structure(0)
            gstname = gststruct.get_name()
            if gstname.find("video") != -1:
                sinkpad = streammux.get_request_pad("sink_0")
                decoder_src_pad.link(sinkpad)

        source.connect("pad-added", cb_newpad, streammux)

    streammux.link(pgie)
    pgie.link(tracker)
    tracker.link(nvvidconv)
    nvvidconv.link(nvosd)
    nvosd.link(encoder)
    encoder.link(h264parse)
    h264parse.link(rtppay)
    rtppay.link(udpsink)

    # Add Python Pad Probe to the sink pad of OSD to extract data
    osd_sink_pad = nvosd.get_static_pad("sink")
    if not osd_sink_pad:
        logger.error("Unable to get sink pad of nvosd")
    else:
        osd_sink_pad.add_probe(Gst.PadProbeType.BUFFER, osd_sink_pad_buffer_probe, 0)

    # Add C++ Logic Pad Probe to the src pad of Tracker
    try:
        if cpp_probe_service.is_available:
            tracker_src_pad = tracker.get_static_pad("src")
            if tracker_src_pad:
                # Use the new attach helper to inject the C++ probe naturally into GStreamer
                pad_ptr = hash(tracker_src_pad)
                cpp_probe_service.attach_probe(pad_ptr)
                logger.success("C++ Counting & Mapping Probe successfully attached to Tracker src pad.")
    except Exception as e:
        logger.error(f"Could not link C++ probe natively: {e}")

    logger.info("Starting pipeline")
    pipeline.set_state(Gst.State.PLAYING)

    try:
        loop = GLib.MainLoop()
        loop.run()
    except KeyboardInterrupt:
        logger.warning("Pipeline interrupted by user.")
    finally:
        pipeline.set_state(Gst.State.NULL)
        settings_sub.stop()
        frame_data_queue.put(None)
        pub_thread.join()

if __name__ == "__main__":
    main()
