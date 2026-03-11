from django.urls import path
from . import consumers

websocket_urlpatterns = [
    # Endpoint for Frontend to send calibration data and for Edge Devices to listen.
    path('ws/settings/mapping/', consumers.MappingConsumer.as_asgi()),
]
