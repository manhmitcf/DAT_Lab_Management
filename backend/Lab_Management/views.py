import os
import json
from django.conf import settings
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from pydantic import ValidationError
from django.db import transaction
from .models import Calibration, CountingSetting, Correspondence
from .schemas import MappingRequest, CountingRequest

@api_view(['GET'])
def get_mapping_settings(request):
    """
    Returns the most recent mapping settings from the database.
    If none exist, falls back to config/mapping_config.json,
    saves the fallback to the database, and returns it.
    """
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
        try:
            validated_schema = MappingRequest.model_validate(mapping_data)
            return Response(validated_schema.model_dump())
        except ValidationError as e:
            return Response({"error": "Mapping data validation failed", "details": e.errors()}, status=500)
    
    # DB is empty, read from file
    file_path = os.path.join(settings.BASE_DIR, 'Lab_Management', 'config', 'mapping_config.json')
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            mapping_data = json.load(f)
        
        validated_schema = MappingRequest.model_validate(mapping_data)
        
        # Save to DB
        with transaction.atomic():
            new_calib = Calibration.objects.create(
                image_width=validated_schema.image_size.width,
                image_height=validated_schema.image_size.height,
                map_width=validated_schema.map_size.width,
                map_height=validated_schema.map_size.height
            )
            for corr in validated_schema.correspondences:
                Correspondence.objects.create(
                    calibration=new_calib,
                    label=corr.label,
                    camera=corr.camera,
                    map=corr.map
                )
                
        return Response(validated_schema.model_dump())

    except FileNotFoundError:
        return Response({"error": "Config file not found"}, status=404)
    except ValidationError as e:
        return Response({"error": "Config file schema validation failed", "details": e.errors()}, status=500)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_counting_settings(request):
    """
    Returns the most recent counting settings from the database.
    If none exist, falls back to config/counting_config.json,
    saves the fallback to the database, and returns it.
    """
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
        try:
            validated_schema = CountingRequest.model_validate(counting_data)
            return Response(validated_schema.model_dump())
        except ValidationError as e:
            return Response({"error": "Counting data validation failed", "details": e.errors()}, status=500)

    # DB is empty, read from file
    file_path = os.path.join(settings.BASE_DIR, 'Lab_Management', 'config', 'counting_config.json')
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            counting_data = json.load(f)
            
        validated_schema = CountingRequest.model_validate(counting_data)
        
        # Save to DB
        CountingSetting.objects.create(
            line_start=validated_schema.line_start,
            line_end=validated_schema.line_end,
            inside_point=validated_schema.inside_point,
            crossing_margin=validated_schema.crossing_margin,
            frame_height=validated_schema.frame_height,
            frame_width=validated_schema.frame_width
        )
            
        return Response(validated_schema.model_dump())

    except FileNotFoundError:
        return Response({"error": "Config file not found"}, status=404)
    except ValidationError as e:
        return Response({"error": "Config file schema validation failed", "details": e.errors()}, status=500)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
