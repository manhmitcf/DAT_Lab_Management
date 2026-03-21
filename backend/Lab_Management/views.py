import os
import json
from django.conf import settings
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from pydantic import ValidationError
from .models import Calibration, CountingSetting
from .schemas import MappingRequest, CountingRequest

@api_view(['GET'])
def get_mapping_settings(request):
    """
    Returns the most recent mapping settings from the database.
    If none exist, falls back to config/mapping_config.json.
    Validates output through MappingRequest schema.
    """
    mapping_data = {}
    latest_calib = Calibration.objects.first()
    if latest_calib:
        correspondences = latest_calib.correspondences.all()
        mapping_data = {
            "image_size": {
                "width": latest_calib.image_width,
                "height": latest_calib.image_height
            },
            "map_size": {
                "width": latest_calib.map_width,
                "height": latest_calib.map_height
            },
            "correspondences": [
                {
                    "label": c.label,
                    "camera": c.camera,
                    "map": c.map
                }
                for c in correspondences
            ]
        }
    else:
        # Fallback to file mapping_config.json
        file_path = os.path.join(settings.BASE_DIR, 'Lab_Management', 'config', 'mapping_config.json')
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                mapping_data = json.load(f)
        except Exception:
            mapping_data = {}

    try:
        validated_schema = MappingRequest.model_validate(mapping_data)
        return Response(validated_schema.model_dump())
    except ValidationError as e:
        return Response({
            "error": "Mapping data validation failed",
            "details": e.errors()
        }, status=500)


@api_view(['GET'])
def get_counting_settings(request):
    """
    Returns the most recent counting settings from the database.
    If none exist, falls back to config/counting_config.json.
    Validates output through CountingRequest schema.
    """
    counting_data = {}
    latest_counting = CountingSetting.objects.first()
    if latest_counting:
        counting_data = {
            "line_start": latest_counting.line_start,
            "line_end": latest_counting.line_end,
            "inside_point": latest_counting.inside_point,
            "crossing_margin": latest_counting.crossing_margin,
            "frame_height": latest_counting.frame_height,
            "frame_width": latest_counting.frame_width
        }
    else:
        # Fallback to file counting_config.json
        file_path = os.path.join(settings.BASE_DIR, 'Lab_Management', 'config', 'counting_config.json')
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                counting_data = json.load(f)
        except Exception:
            counting_data = {}

    try:
        validated_schema = CountingRequest.model_validate(counting_data)
        return Response(validated_schema.model_dump())
    except ValidationError as e:
        return Response({
            "error": "Counting data validation failed",
            "details": e.errors()
        }, status=500)
