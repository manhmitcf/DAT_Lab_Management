"""
Tests for the analytics app.
Uses SQLite in-memory DB — no .env / PostgreSQL needed.

Run with:
    .\venv\Scripts\python.exe manage.py test analytics -v2
"""
from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from Lab_Management.models import FrameData, ObjectDetection


class AnalyticsBaseTestCase(TestCase):
    """Base class that seeds the DB with realistic test data."""

    @classmethod
    def setUpTestData(cls):
        cls.client_api = APIClient()
        now = timezone.now()

        # Create frames across multiple hours/days
        cls.frames = []
        for day_offset in range(3):  # 3 days of data
            for hour in range(8, 18):  # 8 AM → 5 PM
                ts = (now - timedelta(days=day_offset)).replace(
                    hour=hour, minute=0, second=0, microsecond=0
                )
                frame = FrameData.objects.create(
                    timestamp=ts,
                    count_in=10 + hour * 2 + day_offset,
                    count_out=5 + hour + day_offset,
                    alert='none' if hour < 14 else 'warning',
                    height_frame=720,
                    width_frame=1280,
                    height_2D=500,
                    width_2D=500,
                )
                cls.frames.append(frame)

                # Add detections
                num_detections = 3 + (hour % 5)
                for i in range(num_detections):
                    ObjectDetection.objects.create(
                        frame_data=frame,
                        track_id=100 + i + day_offset * 20,
                        bbox=[100 + i * 30, 200, 150 + i * 30, 350],
                        coordinates_2D=[125 + i * 10, 250],
                    )


# -----------------------------------------------------------------------
# 1. Summary
# -----------------------------------------------------------------------
class SummaryViewTests(AnalyticsBaseTestCase):
    def test_summary_returns_200(self):
        response = self.client.get('/api/lab_management/analytics/summary', {'period': '7d'})
        self.assertEqual(response.status_code, 200)

    def test_summary_has_required_fields(self):
        response = self.client.get('/api/lab_management/analytics/summary', {'period': '7d'})
        data = response.json()
        required = ['current_occupancy', 'peak_occupancy', 'peak_time',
                     'avg_dwell_time_minutes', 'total_in', 'total_out', 'net_flow']
        for field in required:
            self.assertIn(field, data, f"Missing field: {field}")

    def test_summary_default_period(self):
        """Should default to 'today' when no period given."""
        response = self.client.get('/api/lab_management/analytics/summary')
        self.assertEqual(response.status_code, 200)

    def test_summary_types(self):
        response = self.client.get('/api/lab_management/analytics/summary', {'period': '7d'})
        data = response.json()
        self.assertIsInstance(data['current_occupancy'], int)
        self.assertIsInstance(data['peak_occupancy'], int)
        self.assertIsInstance(data['total_in'], int)
        self.assertIsInstance(data['total_out'], int)
        self.assertIsInstance(data['net_flow'], int)
        self.assertIsInstance(data['avg_dwell_time_minutes'], (int, float))


# -----------------------------------------------------------------------
# 2. Occupancy Trends
# -----------------------------------------------------------------------
class OccupancyTrendsViewTests(AnalyticsBaseTestCase):
    def test_trends_returns_200(self):
        response = self.client.get('/api/lab_management/analytics/occupancy-trends', {'period': '7d'})
        self.assertEqual(response.status_code, 200)

    def test_trends_has_current_and_previous(self):
        response = self.client.get('/api/lab_management/analytics/occupancy-trends', {'period': '7d'})
        data = response.json()
        self.assertIn('current', data)
        self.assertIn('previous', data)
        self.assertIsInstance(data['current'], list)
        self.assertIsInstance(data['previous'], list)

    def test_trends_entry_structure(self):
        response = self.client.get('/api/lab_management/analytics/occupancy-trends', {'period': '7d'})
        data = response.json()
        if data['current']:
            entry = data['current'][0]
            self.assertIn('time', entry)
            self.assertIn('occupancy', entry)
            self.assertIn('ingress', entry)
            self.assertIn('egress', entry)


# -----------------------------------------------------------------------
# 3. Heatmap
# -----------------------------------------------------------------------
class HeatmapViewTests(AnalyticsBaseTestCase):
    def test_heatmap_returns_200(self):
        response = self.client.get('/api/lab_management/analytics/heatmap', {'period': '7d'})
        self.assertEqual(response.status_code, 200)

    def test_heatmap_structure(self):
        response = self.client.get('/api/lab_management/analytics/heatmap', {'period': '7d'})
        data = response.json()
        self.assertIn('data', data)
        # Should have 7 days
        self.assertEqual(len(data['data']), 7)
        for day_entry in data['data']:
            self.assertIn('day', day_entry)
            self.assertIn('hours', day_entry)
            # Each day should have 24 hours
            self.assertEqual(len(day_entry['hours']), 24)

    def test_heatmap_intensity_range(self):
        response = self.client.get('/api/lab_management/analytics/heatmap', {'period': '7d'})
        data = response.json()
        for day_entry in data['data']:
            for val in day_entry['hours']:
                self.assertGreaterEqual(val, 0.0)
                self.assertLessEqual(val, 1.0)


# -----------------------------------------------------------------------
# 4. Traffic Daily
# -----------------------------------------------------------------------
class TrafficDailyViewTests(AnalyticsBaseTestCase):
    def test_traffic_daily_returns_200(self):
        response = self.client.get('/api/lab_management/analytics/traffic-daily', {'period': '7d'})
        self.assertEqual(response.status_code, 200)

    def test_traffic_daily_structure(self):
        response = self.client.get('/api/lab_management/analytics/traffic-daily', {'period': '7d'})
        data = response.json()
        self.assertIn('data', data)
        for entry in data['data']:
            self.assertIn('day', entry)
            self.assertIn('total_in', entry)
            self.assertIn('total_out', entry)


# -----------------------------------------------------------------------
# 5. Flow Ratio
# -----------------------------------------------------------------------
class FlowRatioViewTests(AnalyticsBaseTestCase):
    def test_flow_ratio_returns_200(self):
        response = self.client.get('/api/lab_management/analytics/flow-ratio', {'period': '7d'})
        self.assertEqual(response.status_code, 200)

    def test_flow_ratio_structure(self):
        response = self.client.get('/api/lab_management/analytics/flow-ratio', {'period': '7d'})
        data = response.json()
        self.assertIn('entry_exit', data)
        self.assertIn('dwell_distribution', data)

        ee = data['entry_exit']
        self.assertIn('total_in', ee)
        self.assertIn('total_out', ee)
        self.assertIn('in_percentage', ee)
        self.assertIn('out_percentage', ee)

    def test_dwell_distribution_buckets(self):
        response = self.client.get('/api/lab_management/analytics/flow-ratio', {'period': '7d'})
        data = response.json()
        buckets = data['dwell_distribution']
        self.assertEqual(len(buckets), 4)
        expected_ranges = ['< 5 min', '5-15 min', '15-30 min', '> 30 min']
        for bucket in buckets:
            self.assertIn(bucket['range'], expected_ranges)
            self.assertIn('percentage', bucket)


# -----------------------------------------------------------------------
# 6. Peak Daily
# -----------------------------------------------------------------------
class PeakDailyViewTests(AnalyticsBaseTestCase):
    def test_peak_daily_returns_200(self):
        response = self.client.get('/api/lab_management/analytics/peak-daily', {'period': '7d'})
        self.assertEqual(response.status_code, 200)

    def test_peak_daily_structure(self):
        response = self.client.get('/api/lab_management/analytics/peak-daily', {'period': '7d'})
        data = response.json()
        self.assertIn('data', data)
        for entry in data['data']:
            self.assertIn('day', entry)
            self.assertIn('peak', entry)
            self.assertIn('time', entry)


# -----------------------------------------------------------------------
# 7. Cumulative Traffic
# -----------------------------------------------------------------------
class CumulativeTrafficViewTests(AnalyticsBaseTestCase):
    def test_cumulative_returns_200(self):
        response = self.client.get('/api/lab_management/analytics/cumulative-traffic', {'period': '7d'})
        self.assertEqual(response.status_code, 200)

    def test_cumulative_structure(self):
        response = self.client.get('/api/lab_management/analytics/cumulative-traffic', {'period': '7d'})
        data = response.json()
        self.assertIn('data', data)
        for entry in data['data']:
            self.assertIn('time', entry)
            self.assertIn('cumulative_in', entry)
            self.assertIn('cumulative_out', entry)


# -----------------------------------------------------------------------
# 8. Dwell By Hour
# -----------------------------------------------------------------------
class DwellByHourViewTests(AnalyticsBaseTestCase):
    def test_dwell_by_hour_returns_200(self):
        response = self.client.get('/api/lab_management/analytics/dwell-by-hour', {'period': '7d'})
        self.assertEqual(response.status_code, 200)

    def test_dwell_by_hour_structure(self):
        response = self.client.get('/api/lab_management/analytics/dwell-by-hour', {'period': '7d'})
        data = response.json()
        self.assertIn('data', data)
        # Should have 24 entries (one per hour)
        self.assertEqual(len(data['data']), 24)
        for entry in data['data']:
            self.assertIn('time', entry)
            self.assertIn('avg_dwell', entry)


# -----------------------------------------------------------------------
# 9. Export CSV
# -----------------------------------------------------------------------
class ExportViewTests(AnalyticsBaseTestCase):
    def test_export_returns_200(self):
        response = self.client.get('/api/lab_management/analytics/export', {'period': '7d'})
        self.assertEqual(response.status_code, 200)

    def test_export_content_type(self):
        response = self.client.get('/api/lab_management/analytics/export', {'period': '7d'})
        self.assertEqual(response['Content-Type'], 'text/csv')

    def test_export_has_header_row(self):
        response = self.client.get('/api/lab_management/analytics/export', {'period': '7d'})
        content = response.content.decode('utf-8')
        first_line = content.split('\r\n')[0]
        self.assertIn('timestamp', first_line)
        self.assertIn('count_in', first_line)
        self.assertIn('count_out', first_line)

    def test_export_has_data_rows(self):
        response = self.client.get('/api/lab_management/analytics/export', {'period': '7d'})
        content = response.content.decode('utf-8')
        lines = [l for l in content.split('\r\n') if l.strip()]
        # Header + data rows
        self.assertGreater(len(lines), 1)


# -----------------------------------------------------------------------
# Edge cases
# -----------------------------------------------------------------------
class EmptyDataTests(TestCase):
    """Test endpoints with no data in the DB."""

    def test_summary_empty(self):
        response = self.client.get('/api/lab_management/analytics/summary', {'period': 'today'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['current_occupancy'], 0)
        self.assertEqual(data['total_in'], 0)

    def test_heatmap_empty(self):
        response = self.client.get('/api/lab_management/analytics/heatmap', {'period': '7d'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data['data']), 7)

    def test_export_empty(self):
        response = self.client.get('/api/lab_management/analytics/export', {'period': 'today'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')

    def test_invalid_period_defaults_to_today(self):
        response = self.client.get('/api/lab_management/analytics/summary', {'period': 'invalid'})
        self.assertEqual(response.status_code, 200)
