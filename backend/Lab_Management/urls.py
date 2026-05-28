from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import get_mapping_settings, get_counting_settings

router = DefaultRouter()

urlpatterns = [
    path('', include(router.urls)),
    path('settings/mapping/', get_mapping_settings, name='mapping-settings'),
    path('settings/counting/', get_counting_settings, name='counting-settings'),
]
