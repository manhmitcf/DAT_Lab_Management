from django.urls import re_path, path
from . import consumers

websocket_urlpatterns = [
    # Use path() for simplicity and accuracy
    path('ws/edge/data/', consumers.EdgeDeviceConsumer.as_asgi()),
]
