import os
import sys
import time
import queue
import threading
from datetime import datetime, timezone
from loguru import logger
import ctypes

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

def main():
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

    # Create Elements
    source = Gst.ElementFactory.make("uridecodebin", "source")
    video_path = "file://" + os.path.abspath("videos/demo.mp4")
    source.set_property("uri", video_path)

    streammux = Gst.ElementFactory.make("nvstreammux", "stream-muxer")
    streammux.set_property("width", 1920)
    streammux.set_property("height", 1080)
    streammux.set_property("batch-size", 1)
    streammux.set_property("batched-push-timeout", 40000)

    pgie = Gst.ElementFactory.make("nvinfer", "primary-inference")
    pgie.set_property("config-file-path", "deploy/DeepStream/config_infer_primary_yolox.txt")

    tracker = Gst.ElementFactory.make("nvtracker", "tracker")
    tracker.set_property("ll-lib-file", "/workspace/ai_core/deploy/OCSort/cpp/build/libnvds_ocsort.so")
    tracker.set_property("enable-batch-process", 1)

    nvvidconv = Gst.ElementFactory.make("nvvideoconvert", "convertor")
    nvosd = Gst.ElementFactory.make("nvdsosd", "onscreendisplay")

    encoder = Gst.ElementFactory.make("nvv4l2h264enc", "h264-encoder")
    encoder.set_property("bitrate", 2000000)
    encoder.set_property("preset-level", 1)
    encoder.set_property("insert-sps-pps", 1)

    rtppay = Gst.ElementFactory.make("rtph264pay", "rtp-payer")
    rtppay.set_property("pt", 96)

    udpsink = Gst.ElementFactory.make("udpsink", "udp-sink")
    udpsink.set_property("host", janus_ip)
    udpsink.set_property("port", janus_port)
    udpsink.set_property("async", False)
    udpsink.set_property("sync", False)

    # Add elements to pipeline
    elements = [streammux, pgie, tracker, nvvidconv, nvosd, encoder, rtppay, udpsink]
    for elem in elements:
        if not elem:
            logger.error(f"Failed to create some pipeline element.")
            sys.exit(1)
        pipeline.add(elem)

    pipeline.add(source)

    # Link elements
    streammux.link(pgie)
    pgie.link(tracker)
    tracker.link(nvvidconv)
    nvvidconv.link(nvosd)
    nvosd.link(encoder)
    encoder.link(rtppay)
    rtppay.link(udpsink)

    def cb_newpad(decodebin, decoder_src_pad, data):
        logger.info("In cb_newpad")
        caps = decoder_src_pad.get_current_caps()
        gststruct = caps.get_structure(0)
        gstname = gststruct.get_name()
        sinkpad = streammux.get_request_pad("sink_0")
        if gstname.find("video") != -1:
            decoder_src_pad.link(sinkpad)

    source.connect("pad-added", cb_newpad, streammux)

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
