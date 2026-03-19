from django.urls import path
from . import views

urlpatterns = [
    path('analytics/summary', views.summary_view, name='analytics-summary'),
    path('analytics/occupancy-trends', views.occupancy_trends_view, name='analytics-occupancy-trends'),
    path('analytics/heatmap', views.heatmap_view, name='analytics-heatmap'),
    path('analytics/traffic-daily', views.traffic_daily_view, name='analytics-traffic-daily'),
    path('analytics/flow-ratio', views.flow_ratio_view, name='analytics-flow-ratio'),
    path('analytics/peak-daily', views.peak_daily_view, name='analytics-peak-daily'),
    path('analytics/cumulative-traffic', views.cumulative_traffic_view, name='analytics-cumulative-traffic'),
    path('analytics/dwell-by-hour', views.dwell_by_hour_view, name='analytics-dwell-by-hour'),
    path('analytics/export', views.export_view, name='analytics-export'),
]
