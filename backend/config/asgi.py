import os
import django
from django.core.asgi import get_asgi_application

# 1. Set environment variable FIRST
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# 2. Initialize Django ASGI application early to ensure apps are loaded
django_asgi_app = get_asgi_application()

# 3. Import Channels routing AFTER Django setup
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import Lab_Management.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            Lab_Management.routing.websocket_urlpatterns
        )
    ),
})
