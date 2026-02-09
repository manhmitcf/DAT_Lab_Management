from django.db import models
from django.contrib.postgres.fields import ArrayField

class FrameData(models.Model):
    frame_id = models.IntegerField(help_text="Sequential frame index")
    timestamp = models.DateTimeField(help_text="UTC inference timestamp")
    count_in = models.IntegerField(default=0, help_text="Cumulative count of entries")
    count_out = models.IntegerField(default=0, help_text="Cumulative count of exits")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        return f"Frame {self.frame_id} at {self.timestamp}"

class ObjectDetection(models.Model):
    # Changed related_name from 'objects' to 'detections' to avoid conflict with default Manager
    frame_data = models.ForeignKey(FrameData, related_name='detections', on_delete=models.CASCADE)
    track_id = models.IntegerField(help_text="Unique tracking ID of the object")
    class_name = models.CharField(max_length=50, help_text="Object category/class")
    conf = models.FloatField(help_text="Model confidence score (0-1)")
    bbox = models.JSONField(help_text="Bounding box [x1, y1, x2, y2]")
    coordinates = models.JSONField(help_text="Center coordinates [x, y]")
    height = models.FloatField(help_text="Object height in pixels")
    width = models.FloatField(help_text="Object width in pixels")

    def __str__(self):
        return f"{self.class_name} ({self.track_id}) in Frame {self.frame_data.frame_id}"
