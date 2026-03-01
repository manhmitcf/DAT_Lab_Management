from django.urls import path
from . import consumers

websocket_urlpatterns = [
    # Endpoint for Edge Device to send data upstream
    path('ws/edge/data/', consumers.EdgeDeviceConsumer.as_asgi()),
    
    # Endpoint for Frontend to listen for realtime data
    path('ws/frontend/frames/', consumers.FrontendConsumer.as_asgi()),
]
