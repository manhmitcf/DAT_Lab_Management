"""
Pipeline Manager for DeepStream.
Orchestrates the assembly, execution, and lifecycle of the GStreamer pipeline.
"""

import sys
import gi

gi.require_version("Gst", "1.0")
from gi.repository import Gst, GLib
from loguru import logger

from services.pipeline.elements import ElementFactory
from services.pipeline.bus import BusManager
from services.pipeline.probe import AnalyticsProbe


class PipelineManager:
    """
    Orchestrator for the DeepStream Pipeline.
    """

    def __init__(self):
        Gst.init(None)
        self.loop = GLib.MainLoop()
        self.pipeline = Gst.Pipeline.new("jetson-analytics-pipeline")
        self.bus_manager = BusManager(self.pipeline, self.loop)
        
        self.elements = {}
        self.is_running = False

    def build_pipeline(self, source_uri: str, config_infer: str):
        """
        Build the DeepStream pipeline graph.
        
        Structure: 
        filesrc/v4l2src -> h264parse -> nvv4l2decoder -> nvstreammux -> 
        nvinfer (YOLOX) -> nvvideoconvert -> nvdsosd -> nveglglessink/fakesink
        """
        logger.info(f"[Pipeline] Building pipeline for source: {source_uri}")

        # 1. Create Elements
        try:
            # Source handling
            if source_uri.startswith("rtsp://") or source_uri.startswith("http://") or source_uri.endswith(".mp4"):
                self.elements["source"] = ElementFactory.create("filesrc", "file-source")
                self.elements["source"].set_property("location", source_uri)
                self.elements["qtdemux"] = ElementFactory.create("qtdemux", "demux")
                self.elements["h264parse"] = ElementFactory.create("h264parse", "h264-parser")
                self.elements["decoder"] = ElementFactory.create("nvv4l2decoder", "decoder")
            else:
                self.elements["source"] = ElementFactory.create("v4l2src", "usb-source")
                self.elements["source"].set_property("device", source_uri)
                self.elements["videoconvert"] = ElementFactory.create("videoconvert", "raw-convert")
                self.elements["capsfilter"] = ElementFactory.create("capsfilter", "raw-caps")
                self.elements["capsfilter"].set_property(
                    "caps", Gst.Caps.from_string("video/x-raw, format=YUY2")
                )
                self.elements["decoder"] = ElementFactory.create("nvvideoconvert", "hw-convert")

            # DeepStream Core
            self.elements["muxer"] = ElementFactory.create_and_configure(
                "nvstreammux", "stream-muxer",
                {"width": 1920, "height": 1080, "batch-size": 1, "batched-push-timeout": 40000}
            )
            
            self.elements["pgie"] = ElementFactory.create_and_configure(
                "nvinfer", "primary-inference",
                {"config-file-path": config_infer}
            )
            
            # Visualization & Sink
            self.elements["nvvidconv"] = ElementFactory.create("nvvideoconvert", "nvvideo-converter")
            self.elements["nvosd"] = ElementFactory.create("nvdsosd", "on-screen-display")
            
            # Use fakesink for performance, or eglglessink for local display
            self.elements["sink"] = ElementFactory.create_and_configure(
                "fakesink", "sink", 
                {"sync": True}
            )

            # 2. Add elements to pipeline
            for el in self.elements.values():
                self.pipeline.add(el)

            # 3. Link elements (Sequential)
            # Note: filesrc -> qtdemux is dynamic, will need pad-added signal
            if "qtdemux" in self.elements:
                self.elements["source"].link(self.elements["qtdemux"])
                self.elements["qtdemux"].connect("pad-added", self._on_pad_added)
                # Link the rest from decoder onwards
                self.elements["h264parse"].link(self.elements["decoder"])
            else:
                self.elements["source"].link(self.elements["videoconvert"])
                self.elements["videoconvert"].link(self.elements["capsfilter"])
                self.elements["capsfilter"].link(self.elements["decoder"])

            # Common StreamMux Link
            sink_pad = self.elements["muxer"].get_request_pad("sink_0")
            src_pad = self.elements["decoder"].get_static_pad("src")
            src_pad.link(sink_pad)

            # Sequence: muxer -> pgie -> nvvidconv -> nvosd -> sink
            self.elements["muxer"].link(self.elements["pgie"])
            self.elements["pgie"].link(self.elements["nvvidconv"])
            self.elements["nvvidconv"].link(self.elements["nvosd"])
            self.elements["nvosd"].link(self.elements["sink"])

            logger.success("[Pipeline] Pipeline linked successfully.")

        except Exception as e:
            logger.error(f"[Pipeline] Failed to build pipeline: {e}")
            raise

    def attach_probe(self, probe_handler: AnalyticsProbe):
        """
        Attach the AnalyticsProbe to the nvinfer source pad.
        """
        pgie_src_pad = self.elements["pgie"].get_static_pad("src")
        if not pgie_src_pad:
            logger.error("[Pipeline] Unable to get nvinfer src pad")
            return
        
        pgie_src_pad.add_probe(Gst.PadProbeType.BUFFER, probe_handler.probe_callback, None)
        logger.info("[Pipeline] AnalyticsProbe attached to nvinfer src pad.")

    def run(self):
        """
        Start the pipeline execution.
        """
        self.bus_manager.setup()
        
        logger.info("[Pipeline] Starting pipeline...")
        self.pipeline.set_state(Gst.State.PLAYING)
        self.is_running = True
        
        try:
            self.loop.run()
        except KeyboardInterrupt:
            logger.warning("[Pipeline] Interrupted by user.")
        finally:
            self.stop()

    def stop(self):
        """
        Gracefully stop the pipeline.
        """
        if not self.is_running:
            return
            
        logger.info("[Pipeline] Stopping pipeline...")
        self.pipeline.set_state(Gst.State.NULL)
        self.bus_manager.teardown()
        self.is_running = False
        logger.success("[Pipeline] Pipeline stopped.")

    def _on_pad_added(self, src, pad):
        """Dynamic link handler for demuxer."""
        sink_pad = self.elements["h264parse"].get_static_pad("sink")
        pad.link(sink_pad)
