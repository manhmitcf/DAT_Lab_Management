import os
import sys
from loguru import logger

import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib

class PipelineManager:
    """
    Builds, manages, and runs the GStreamer DeepStream pipeline.
    This version processes at 1080p and forks a downscaled 720p stream for Janus.
    """
    def __init__(self, app_instance):
        self.app = app_instance
        self.pipeline = None
        self.loop = None
        self.streammux = None

    def build_pipeline(self) -> None:
        """Creates and links the entire GStreamer DeepStream network pipeline."""
        logger.info("[PIPELINE] Initializing GStreamer elements...")
        Gst.init(None)
        self.pipeline = Gst.Pipeline()

        is_live = self.app.video_source.startswith("/dev/video")
        
        # --- Create Core Processing Elements (1080p) ---
        if is_live:
            source, caps_v4l2src, cam_queue, jpegparse, jpegdec = self._create_live_source_bin()
        else:
            source = self._create_uri_source_bin()
            caps_v4l2src, cam_queue, jpegparse, jpegdec = None, None, None, None

        nvvidconv_src, caps_vidconv_src = self._create_input_conversion_bin()
        self.streammux = self._create_streammux(is_live)
        pgie = self._create_pgie()
        tracker = self._create_tracker()
        nvvidconv_osd, nvosd = Gst.ElementFactory.make("nvvideoconvert", "convertor-osd"), Gst.ElementFactory.make("nvdsosd", "onscreendisplay")

        # --- Create the Fork and the Janus Streaming Branch (720p) ---
        tee = Gst.ElementFactory.make("tee", "video-splitter")
        janus_queue, nvvidconv_scale, caps_scale, encoder, h264parse, rtppay, udpsink = self._create_webrtc_sink_bin()

        # Add all elements to the pipeline
        elements = [e for e in [
            source, caps_v4l2src, cam_queue, jpegparse, jpegdec, 
            nvvidconv_src, caps_vidconv_src, self.streammux, pgie, tracker, 
            nvvidconv_osd, nvosd, tee, janus_queue, nvvidconv_scale, caps_scale, 
            encoder, h264parse, rtppay, udpsink
        ] if e]
        for elem in elements:
            self.pipeline.add(elem)

        # Link elements
        self._link_elements(is_live, source, caps_v4l2src, cam_queue, jpegparse, jpegdec, nvvidconv_src, caps_vidconv_src, self.streammux, pgie, tracker, nvvidconv_osd, nvosd, tee, janus_queue, nvvidconv_scale, caps_scale, encoder, h264parse, rtppay, udpsink)
        
        self._attach_probes(nvosd)
        logger.success("[PIPELINE] All elements created and linked successfully.")

    def run(self):
        logger.info("[PIPELINE] Setting pipeline to PLAYING state...")
        self.pipeline.set_state(Gst.State.PLAYING)
        logger.success("[PIPELINE] Pipeline is now PLAYING.")
        try:
            self.loop = GLib.MainLoop()
            self.loop.run()
        except KeyboardInterrupt:
            logger.warning("[PIPELINE] Interrupted by user. Shutting down...")
        finally:
            self.stop()

    def stop(self):
        if self.pipeline:
            logger.info("[PIPELINE] Shutting down pipeline and releasing resources...")
            self.pipeline.set_state(Gst.State.NULL)
            self.pipeline = None
        if self.loop and self.loop.is_running():
            self.loop.quit()
            
    # --- Private Helper Methods for Element Creation ---

    def _create_live_source_bin(self):
        source = Gst.ElementFactory.make("v4l2src", "source")
        source.set_property("device", self.app.video_source)
        source.set_property("io-mode", 2)
        source.set_property("do-timestamp", True)
        caps_v4l2src = Gst.ElementFactory.make("capsfilter", "v4l2src_caps")
        caps_v4l2src.set_property("caps", Gst.Caps.from_string("image/jpeg,width=1920,height=1080,framerate=30/1"))
        cam_queue = Gst.ElementFactory.make("queue", "camera-queue")
        cam_queue.set_property("max-size-buffers", 1)
        cam_queue.set_property("leaky", 2)
        jpegparse = Gst.ElementFactory.make("jpegparse", "jpeg-parser")
        jpegdec = Gst.ElementFactory.make("nvv4l2decoder", "jpeg-decoder")
        jpegdec.set_property("mjpeg", 1)
        return source, caps_v4l2src, cam_queue, jpegparse, jpegdec

    def _create_uri_source_bin(self):
        uri = self.app.video_source
        if not uri.startswith(("rtsp://", "http://", "file://")):
            uri = f"file://{os.path.abspath(uri)}"
        logger.info(f"Using URI Source: {uri}")
        source = Gst.ElementFactory.make("uridecodebin", "source")
        source.set_property("uri", uri)
        return source

    def _create_input_conversion_bin(self):
        nvvidconv_src = Gst.ElementFactory.make("nvvideoconvert", "convertor_src")
        caps_vidconv_src = Gst.ElementFactory.make("capsfilter", "caps_vidconv_src")
        caps_vidconv_src.set_property("caps", Gst.Caps.from_string("video/x-raw(memory:NVMM),format=NV12"))
        return nvvidconv_src, caps_vidconv_src

    def _create_streammux(self, is_live):
        streammux = Gst.ElementFactory.make("nvstreammux", "stream-muxer")
        logger.info("Setting pipeline processing resolution to 1920x1080 for logic consistency.")
        streammux.set_property("width", 1920)
        streammux.set_property("height", 1080)
        
        # === START OF OPTIMIZATION ===
        # Increase batch-size to leverage parallel processing capabilities of the GPU.
        # This can significantly increase throughput (FPS).
        logger.info("Setting streammux batch-size to 4 for performance optimization.")
        streammux.set_property("batch-size", 4)
        # === END OF OPTIMIZATION ===

        streammux.set_property("batched-push-timeout", 33000)
        if is_live:
            streammux.set_property("live-source", 1)
        return streammux

    def _create_pgie(self):
        pgie = Gst.ElementFactory.make("nvinfer", "primary-inference")
        pgie.set_property("config-file-path", self.app.pgie_config_path)
        pgie.set_property("unique-id", 1)
        return pgie

    def _create_tracker(self):
        tracker = Gst.ElementFactory.make("nvtracker", "tracker")
        tracker.set_property("ll-lib-file", os.getenv("TRACKER_LIB_PATH", "/workspace/ai_core/deploy/OCSort/cpp/build/libnvds_ocsort.so"))
        tracker.set_property("ll-config-file", os.getenv("TRACKER_CONFIG_PATH", "deploy/DeepStream/config_tracker_ocsort.txt"))
        tracker.set_property("tracker-width", 640)
        tracker.set_property("tracker-height", 640)
        return tracker

    def _create_webrtc_sink_bin(self):
        logger.info("Creating 720p sink branch for Janus WebRTC.")
        janus_queue = Gst.ElementFactory.make("queue", "queue-for-janus")
        nvvidconv_scale = Gst.ElementFactory.make("nvvideoconvert", "scaler-for-janus")
        caps_scale = Gst.ElementFactory.make("capsfilter", "caps-for-scaler")
        caps_scale.set_property("caps", Gst.Caps.from_string("video/x-raw(memory:NVMM), width=1280, height=720"))
        
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
        rtppay.set_property("aggregate-mode", 1)
        udpsink = Gst.ElementFactory.make("udpsink", "udp-sink")
        udpsink.set_property("host", self.app.janus_ip)
        udpsink.set_property("port", self.app.janus_port)
        udpsink.set_property("async", False)
        udpsink.set_property("sync", False)
        return janus_queue, nvvidconv_scale, caps_scale, encoder, h264parse, rtppay, udpsink

    def _link_elements(self, is_live, source, caps_v4l2src, cam_queue, jpegparse, jpegdec, nvvidconv_src, caps_vidconv_src, streammux, pgie, tracker, nvvidconv_osd, nvosd, tee, janus_queue, nvvidconv_scale, caps_scale, encoder, h264parse, rtppay, udpsink):
        def _link(e1, e2):
            if not e1.link(e2):
                logger.error(f"[PIPELINE] Failed to link {e1.get_name()} → {e2.get_name()}")
                sys.exit(1)
            logger.debug(f"[PIPELINE] Linked {e1.get_name()} → {e2.get_name()}")

        # --- Link Main Processing Chain (1080p) ---
        if is_live:
            _link(source, caps_v4l2src)
            _link(caps_v4l2src, cam_queue)
            _link(cam_queue, jpegparse)
            _link(jpegparse, jpegdec)
            _link(jpegdec, nvvidconv_src)
        else:
            source.connect("pad-added", self._cb_newpad, nvvidconv_src)

        _link(nvvidconv_src, caps_vidconv_src)
        
        sinkpad_mux = streammux.get_request_pad("sink_0")
        srcpad_conv = caps_vidconv_src.get_static_pad("src")
        if srcpad_conv.link(sinkpad_mux) != Gst.PadLinkReturn.OK:
            logger.error("[PIPELINE] Failed to link caps_vidconv_src → streammux sinkpad")
            sys.exit(1)
        logger.debug("[PIPELINE] Linked caps_vidconv_src → streammux:sink_0")

        _link(streammux, pgie)
        _link(pgie, tracker)
        _link(tracker, nvvidconv_osd)
        _link(nvvidconv_osd, nvosd)
        _link(nvosd, tee)

        # --- Link Janus Streaming Branch (720p) ---
        tee_src_pad = tee.get_request_pad("src_%u")
        queue_sink_pad = janus_queue.get_static_pad("sink")
        if tee_src_pad.link(queue_sink_pad) != Gst.PadLinkReturn.OK:
            sys.exit("Failed to link tee to janus queue")
        logger.debug("[PIPELINE] Forked stream for Janus branch.")

        _link(janus_queue, nvvidconv_scale)
        _link(nvvidconv_scale, caps_scale)
        _link(caps_scale, encoder)
        _link(encoder, h264parse)
        _link(h264parse, rtppay)
        _link(rtppay, udpsink)

    def _attach_probes(self, nvosd):
        osd_sink_pad = nvosd.get_static_pad("sink")
        if osd_sink_pad:
            osd_sink_pad.add_probe(Gst.PadProbeType.BUFFER, self.app.osd_probe_handler.osd_sink_pad_buffer_probe, 0)
            logger.success("Python OSD Probe attached successfully.")
        else:
            logger.error("Unable to get sink pad of nvosd")

    def _cb_newpad(self, decodebin, decoder_src_pad, data):
        caps = decoder_src_pad.get_current_caps()
        gststruct = caps.get_structure(0)
        gstname = gststruct.get_name()
        if gstname.find("video") != -1:
            sink_pad = data.get_static_pad("sink")
            if not sink_pad.is_linked():
                logger.debug(f"[PIPELINE] uridecodebin linked to {data.get_name()}")
                decoder_src_pad.link(sink_pad)
