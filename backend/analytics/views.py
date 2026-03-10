import csv
from collections import defaultdict
from datetime import timedelta

from django.db.models import Sum, Max, Min, Count, Avg, F, Q
from django.db.models.functions import TruncHour, TruncDate, ExtractHour, ExtractWeekDay
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from Lab_Management.models import FrameData, ObjectDetection
from .utils import parse_period, get_previous_period, DAY_NAMES, HOUR_LABELS


# ---------------------------------------------------------------------------
# 1. GET /analytics/summary?period={period}
# ---------------------------------------------------------------------------
@api_view(['GET'])
def summary_view(request):
    """KPI cards: current occupancy, peak, avg dwell, totals."""
    period = request.query_params.get('period', 'today')
    start, end = parse_period(period)

    frames = FrameData.objects.filter(timestamp__range=(start, end))

    # Latest frame for current occupancy
    latest_frame = frames.order_by('-timestamp').first()
    current_occupancy = 0
    if latest_frame:
        current_occupancy = latest_frame.detections.count()

    # Aggregates
    agg = frames.aggregate(
        total_in=Sum('count_in'),
        total_out=Sum('count_out'),
    )
    total_in = agg['total_in'] or 0
    total_out = agg['total_out'] or 0

    # Use the latest count_in / count_out for accurate cumulative totals
    latest_counts = frames.order_by('-timestamp').values('count_in', 'count_out').first()
    if latest_counts:
        total_in = latest_counts['count_in']
        total_out = latest_counts['count_out']

    # Peak occupancy (max number of detections per frame)
    peak_occupancy = 0
    peak_time = None
    frame_ids = frames.values_list('id', 'timestamp')
    for fid, ts in frame_ids:
        det_count = ObjectDetection.objects.filter(frame_data_id=fid).count()
        if det_count > peak_occupancy:
            peak_occupancy = det_count
            peak_time = ts

    # Avg dwell time: average duration each track_id appears in
    dwell_data = _compute_avg_dwell(start, end)

    return Response({
        'current_occupancy': current_occupancy,
        'peak_occupancy': peak_occupancy,
        'peak_time': peak_time.strftime('%H:%M') if peak_time else None,
        'avg_dwell_time_minutes': round(dwell_data['avg'], 1) if dwell_data['avg'] else 0,
        'total_in': total_in,
        'total_out': total_out,
        'net_flow': total_in - total_out,
    })


# ---------------------------------------------------------------------------
# 2. GET /analytics/occupancy-trends?period={period}
# ---------------------------------------------------------------------------
@api_view(['GET'])
def occupancy_trends_view(request):
    """Line chart: occupancy, ingress, egress over time. Current vs previous."""
    period = request.query_params.get('period', 'today')
    start, end = parse_period(period)
    prev_start, prev_end = get_previous_period(start, end)

    current = _build_trend_data(start, end)
    previous = _build_trend_data(prev_start, prev_end)

    return Response({
        'current': current,
        'previous': previous,
    })


# ---------------------------------------------------------------------------
# 3. GET /analytics/heatmap?period={period}
# ---------------------------------------------------------------------------
@api_view(['GET'])
def heatmap_view(request):
    """Time heatmap: 24h × 7 days. Intensity 0.0 → 1.0."""
    period = request.query_params.get('period', '7d')
    start, end = parse_period(period)

    frames = FrameData.objects.filter(timestamp__range=(start, end))

    # Collect detection counts per (weekday, hour)
    counts = defaultdict(lambda: [0] * 24)
    max_count = 1  # avoid division by zero

    for frame in frames.values('id', 'timestamp'):
        ts = frame['timestamp']
        weekday = ts.weekday()  # 0=Mon, 6=Sun
        hour = ts.hour
        det_count = ObjectDetection.objects.filter(frame_data_id=frame['id']).count()
        counts[weekday][hour] += det_count
        if counts[weekday][hour] > max_count:
            max_count = counts[weekday][hour]

    # Normalize to 0.0–1.0
    data = []
    for day_idx, day_name in enumerate(DAY_NAMES):
        hours = [round(counts[day_idx][h] / max_count, 2) for h in range(24)]
        data.append({'day': day_name, 'hours': hours})

    return Response({'data': data})


# ---------------------------------------------------------------------------
# 4. GET /analytics/traffic-daily?period={period}
# ---------------------------------------------------------------------------
@api_view(['GET'])
def traffic_daily_view(request):
    """Bar chart: traffic per day of week."""
    period = request.query_params.get('period', '7d')
    start, end = parse_period(period)

    frames = FrameData.objects.filter(timestamp__range=(start, end))

    # Group by date, get max count_in/out per day (cumulative counters)
    daily = frames.annotate(date=TruncDate('timestamp')).values('date').annotate(
        max_in=Max('count_in'),
        max_out=Max('count_out'),
    ).order_by('date')

    # Aggregate by weekday name
    day_totals = defaultdict(lambda: {'total_in': 0, 'total_out': 0})
    for entry in daily:
        day_name = DAY_NAMES[entry['date'].weekday()]
        day_totals[day_name]['total_in'] += entry['max_in'] or 0
        day_totals[day_name]['total_out'] += entry['max_out'] or 0

    data = [
        {'day': d, 'total_in': day_totals[d]['total_in'], 'total_out': day_totals[d]['total_out']}
        for d in DAY_NAMES if d in day_totals
    ]

    return Response({'data': data})


# ---------------------------------------------------------------------------
# 5. GET /analytics/flow-ratio?period={period}
# ---------------------------------------------------------------------------
@api_view(['GET'])
def flow_ratio_view(request):
    """Donut chart: entry/exit ratio + dwell distribution."""
    period = request.query_params.get('period', 'today')
    start, end = parse_period(period)

    frames = FrameData.objects.filter(timestamp__range=(start, end))
    latest = frames.order_by('-timestamp').values('count_in', 'count_out').first()

    total_in = latest['count_in'] if latest else 0
    total_out = latest['count_out'] if latest else 0
    total = total_in + total_out

    in_pct = round(total_in / total * 100, 1) if total > 0 else 0
    out_pct = round(total_out / total * 100, 1) if total > 0 else 0

    # Dwell distribution
    dwell_minutes_list = _compute_dwell_list(start, end)
    dwell_dist = _categorize_dwell(dwell_minutes_list)

    return Response({
        'entry_exit': {
            'total_in': total_in,
            'total_out': total_out,
            'in_percentage': in_pct,
            'out_percentage': out_pct,
        },
        'dwell_distribution': dwell_dist,
    })


# ---------------------------------------------------------------------------
# 6. GET /analytics/peak-daily?period={period}
# ---------------------------------------------------------------------------
@api_view(['GET'])
def peak_daily_view(request):
    """Bar chart: peak occupancy per day."""
    period = request.query_params.get('period', '7d')
    start, end = parse_period(period)

    frames = FrameData.objects.filter(
        timestamp__range=(start, end)
    ).annotate(date=TruncDate('timestamp'))

    # Calculate peak per date
    dates = frames.values_list('date', flat=True).distinct()
    data = []
    for d in sorted(set(dates)):
        day_frames = frames.filter(date=d)
        peak = 0
        peak_time = None
        for f in day_frames.values('id', 'timestamp'):
            det_count = ObjectDetection.objects.filter(frame_data_id=f['id']).count()
            if det_count > peak:
                peak = det_count
                peak_time = f['timestamp']

        data.append({
            'day': DAY_NAMES[d.weekday()],
            'peak': peak,
            'time': peak_time.strftime('%H:%M') if peak_time else None,
        })

    return Response({'data': data})


# ---------------------------------------------------------------------------
# 7. GET /analytics/cumulative-traffic?period={period}
# ---------------------------------------------------------------------------
@api_view(['GET'])
def cumulative_traffic_view(request):
    """Area chart: cumulative in/out over the day."""
    period = request.query_params.get('period', 'today')
    start, end = parse_period(period)

    frames = FrameData.objects.filter(
        timestamp__range=(start, end)
    ).annotate(hour=TruncHour('timestamp')).values('hour').annotate(
        max_in=Max('count_in'),
        max_out=Max('count_out'),
    ).order_by('hour')

    data = [
        {
            'time': entry['hour'].strftime('%H:%M'),
            'cumulative_in': entry['max_in'] or 0,
            'cumulative_out': entry['max_out'] or 0,
        }
        for entry in frames
    ]

    return Response({'data': data})


# ---------------------------------------------------------------------------
# 8. GET /analytics/dwell-by-hour?period={period}
# ---------------------------------------------------------------------------
@api_view(['GET'])
def dwell_by_hour_view(request):
    """Line chart: avg dwell time per hour."""
    period = request.query_params.get('period', 'today')
    start, end = parse_period(period)

    # Get all detections in range grouped by hour
    detections = ObjectDetection.objects.filter(
        frame_data__timestamp__range=(start, end)
    ).values('track_id', 'frame_data__timestamp')

    # Group by hour, then compute dwell per track within that hour
    hour_tracks = defaultdict(lambda: defaultdict(list))
    for det in detections:
        ts = det['frame_data__timestamp']
        hour_key = ts.strftime('%H:00')
        hour_tracks[hour_key][det['track_id']].append(ts)

    data = []
    for hour in HOUR_LABELS:
        if hour in hour_tracks:
            dwells = []
            for track_id, timestamps in hour_tracks[hour].items():
                if len(timestamps) >= 2:
                    duration = (max(timestamps) - min(timestamps)).total_seconds() / 60.0
                    dwells.append(duration)
            avg_dwell = round(sum(dwells) / len(dwells), 1) if dwells else 0
            data.append({'time': hour, 'avg_dwell': avg_dwell})
        else:
            data.append({'time': hour, 'avg_dwell': 0})

    return Response({'data': data})


# ---------------------------------------------------------------------------
# 9. GET /analytics/export?period={period}
# ---------------------------------------------------------------------------
@api_view(['GET'])
def export_view(request):
    """Export analytics data as CSV."""
    period = request.query_params.get('period', 'today')
    start, end = parse_period(period)
    now_str = timezone.now().strftime('%Y%m%d')

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="analytics_report_{period}_{now_str}.csv"'

    writer = csv.writer(response)
    writer.writerow([
        'timestamp', 'count_in', 'count_out', 'alert',
        'num_detections', 'height_frame', 'width_frame',
    ])

    frames = FrameData.objects.filter(
        timestamp__range=(start, end)
    ).order_by('timestamp')

    for frame in frames:
        writer.writerow([
            frame.timestamp.isoformat(),
            frame.count_in,
            frame.count_out,
            frame.alert,
            frame.detections.count(),
            frame.height_frame,
            frame.width_frame,
        ])

    return response


# ===========================================================================
# Internal helpers
# ===========================================================================

def _build_trend_data(start, end):
    """Build hourly trend data (occupancy, ingress, egress) for a period."""
    frames = FrameData.objects.filter(
        timestamp__range=(start, end)
    ).annotate(hour=TruncHour('timestamp')).values('hour').annotate(
        max_in=Max('count_in'),
        max_out=Max('count_out'),
    ).order_by('hour')

    result = []
    prev_in = 0
    prev_out = 0
    for entry in frames:
        current_in = entry['max_in'] or 0
        current_out = entry['max_out'] or 0
        ingress = max(current_in - prev_in, 0)
        egress = max(current_out - prev_out, 0)
        occupancy = current_in - current_out

        result.append({
            'time': entry['hour'].strftime('%H:%M'),
            'occupancy': max(occupancy, 0),
            'ingress': ingress,
            'egress': egress,
        })
        prev_in = current_in
        prev_out = current_out

    return result


def _compute_avg_dwell(start, end):
    """Compute average dwell time (minutes) by tracking first/last appearance of each track_id."""
    detections = ObjectDetection.objects.filter(
        frame_data__timestamp__range=(start, end)
    ).values('track_id').annotate(
        first_seen=Min('frame_data__timestamp'),
        last_seen=Max('frame_data__timestamp'),
    )

    durations = []
    for det in detections:
        duration = (det['last_seen'] - det['first_seen']).total_seconds() / 60.0
        durations.append(duration)

    avg = sum(durations) / len(durations) if durations else 0
    return {'avg': avg, 'durations': durations}


def _compute_dwell_list(start, end):
    """Return list of dwell durations in minutes for all tracks in range."""
    data = _compute_avg_dwell(start, end)
    return data['durations']


def _categorize_dwell(dwell_minutes_list):
    """Categorize dwell times into buckets."""
    if not dwell_minutes_list:
        return [
            {'range': '< 5 min', 'percentage': 0},
            {'range': '5-15 min', 'percentage': 0},
            {'range': '15-30 min', 'percentage': 0},
            {'range': '> 30 min', 'percentage': 0},
        ]

    total = len(dwell_minutes_list)
    buckets = {
        '< 5 min': 0,
        '5-15 min': 0,
        '15-30 min': 0,
        '> 30 min': 0,
    }

    for d in dwell_minutes_list:
        if d < 5:
            buckets['< 5 min'] += 1
        elif d < 15:
            buckets['5-15 min'] += 1
        elif d < 30:
            buckets['15-30 min'] += 1
        else:
            buckets['> 30 min'] += 1

    return [
        {'range': k, 'percentage': round(v / total * 100)}
        for k, v in buckets.items()
    ]
