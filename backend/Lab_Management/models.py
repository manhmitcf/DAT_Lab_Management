from django.db import models
from django.contrib.postgres.fields import ArrayField

class FrameData(models.Model):
    frame_id = models.IntegerField(help_text="Sequential frame index")
    timestamp = models.DateTimeField(help_text="UTC inference timestamp")
    
    count_in = models.IntegerField(default=0, help_text="Cumulative count of entries")
    count_out = models.IntegerField(default=0, help_text="Cumulative count of exits")
    
    alert = models.BooleanField(default=False, help_text="Alert flag for abnormal events")
    
    # New fields for dimensions
    height_frame = models.IntegerField(null=True, blank=True, help_text="Height of the original frame")
    width_frame = models.IntegerField(null=True, blank=True, help_text="Width of the original frame")
    height_2D = models.IntegerField(null=True, blank=True, help_text="Height of the 2D map")
    width_2D = models.IntegerField(null=True, blank=True, help_text="Width of the 2D map")
    
    # Base64 image is NOT stored in DB to save space. Only metadata is stored.
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        return f"Frame {self.frame_id} at {self.timestamp}"

class ObjectDetection(models.Model):
    frame_data = models.ForeignKey(FrameData, related_name='detections', on_delete=models.CASCADE)
    
    track_id = models.IntegerField(help_text="Unique tracking ID")
    class_name = models.CharField(max_length=50, help_text="Object class name")
    conf = models.FloatField(help_text="Model confidence score (0-1)")
    
    # Using JSONField for flexibility
    bbox = models.JSONField(help_text="[x1, y1, x2, y2] in pixels")
    
    # Renamed from coordinates to coordinates_2D to match schema
    coordinates_2D = models.JSONField(null=True, blank=True, help_text="[x, y] center projected onto 2D map")
    
    # Removed height/width of object as they are not in the new schema
    # If needed, they can be calculated from bbox

    def __str__(self):
        return f"{self.class_name} ({self.track_id}) in Frame {self.frame_data.frame_id}"
