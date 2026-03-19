from django.db import models
from django.contrib.postgres.fields import ArrayField

class FrameData(models.Model):
    ALERT_CHOICES = [
        ('none', 'None'),
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ]

    # Removed frame_id as requested
    timestamp = models.DateTimeField(help_text="UTC inference timestamp")
    
    count_in = models.IntegerField(default=0, help_text="Cumulative count of entries")
    count_out = models.IntegerField(default=0, help_text="Cumulative count of exits")
    
    alert = models.CharField(
        max_length=10,
        choices=ALERT_CHOICES,
        default='none',
        help_text="Alert level (none, info, warning, critical)"
    )
    
    # New fields for dimensions
    height_frame = models.IntegerField(null=True, blank=True, help_text="Height of the original frame")
    width_frame = models.IntegerField(null=True, blank=True, help_text="Width of the original frame")
    height_2D = models.IntegerField(null=True, blank=True, help_text="Height of the 2D map")
    width_2D = models.IntegerField(null=True, blank=True, help_text="Width of the 2D map")
    
    # Base64 image is NOT stored in DB to save space. Only metadata is stored.
    # Removed created_at as requested (redundant with timestamp)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        return f"Frame at {self.timestamp}"

class ObjectDetection(models.Model):
    frame_data = models.ForeignKey(FrameData, related_name='detections', on_delete=models.CASCADE)
    
    track_id = models.IntegerField(help_text="Unique tracking ID")
    # Removed class_name and conf as requested
    
    # Using JSONField for flexibility
    bbox = models.JSONField(help_text="[x1, y1, x2, y2] in pixels")
    
    # Renamed from coordinates to coordinates_2D to match schema
    coordinates_2D = models.JSONField(null=True, blank=True, help_text="[x, y] center projected onto 2D map")

    def __str__(self):
        return f"Object ({self.track_id}) in Frame {self.frame_data.id}"

# --- Models for Calibration/Mapping ---

class Calibration(models.Model):
    """
    Represents a single calibration session.
    This acts as a container for a set of mapping correspondences. We assume a single,
    globally active calibration, so we'll always use the latest one.
    """
    created_at = models.DateTimeField(auto_now_add=True, help_text="Timestamp when this calibration was created.")
    image_width = models.FloatField(null=True, blank=True)
    image_height = models.FloatField(null=True, blank=True)
    map_width = models.FloatField(null=True, blank=True)
    map_height = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at'] # The most recent calibration is the active one

    def __str__(self):
        return f"Calibration from {self.created_at.strftime('%Y-%m-%d %H:%M:%S')}"

class Correspondence(models.Model):
    """
    Stores a single mapped point used in a calibration session.
    Related to a specific Calibration instance.
    """
    calibration = models.ForeignKey(Calibration, related_name='correspondences', on_delete=models.CASCADE)
    label = models.CharField(max_length=50)
    camera = models.JSONField(help_text="[x, y] coordinates on the camera frame.")
    map = models.JSONField(help_text="[x, y] coordinates on the floor plan.")

    def __str__(self):
        return f"{self.label} for Calibration {self.calibration.id}"

# --- Models for Counting Settings ---

class CountingSetting(models.Model):
    """
    Stores counting line configuration.
    """
    created_at = models.DateTimeField(auto_now_add=True)
    line_start = models.JSONField(help_text="[x, y] start of line")
    line_end = models.JSONField(help_text="[x, y] end of line")
    inside_point = models.JSONField(help_text="[x, y] point indicating 'inside'")
    crossing_margin = models.FloatField()
    frame_width = models.IntegerField(null=True, blank=True)
    frame_height = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Counting Setting from {self.created_at.strftime('%Y-%m-%d %H:%M:%S')}"
