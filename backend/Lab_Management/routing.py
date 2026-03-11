from django.urls import path
from .consumers import MappingConsumer, PersistenceConsumer

websocket_urlpatterns = [
    # Endpoint for calibration mapping (Frontend <-> Edge)
    path('ws/settings/mapping/', MappingConsumer.as_asgi()),

    # Endpoint for Edge Device to send metadata to the backend for storage
    path('ws/persist/metadata/', PersistenceConsumer.as_asgi()),
]
