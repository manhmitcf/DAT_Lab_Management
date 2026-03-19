from datetime import datetime, timedelta
from django.utils import timezone


def parse_period(period_str: str):
    """
    Convert a period string into (start_datetime, end_datetime).
    Supported values: '1h', 'today', '7d', '30d'.
    Returns timezone-aware datetimes (UTC).
    """
    now = timezone.now()

    if period_str == '1h':
        start = now - timedelta(hours=1)
    elif period_str == 'today':
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period_str == '7d':
        start = now - timedelta(days=7)
    elif period_str == '30d':
        start = now - timedelta(days=30)
    else:
        # Default to today
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    return start, now


def get_previous_period(start: datetime, end: datetime):
    """
    Given a (start, end) range, return the equivalent previous period.
    E.g., if start..end spans 7 days, previous = (start-7d, start).
    """
    duration = end - start
    prev_end = start
    prev_start = start - duration
    return prev_start, prev_end


# Day name helpers
DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
HOUR_LABELS = [f"{h:02d}:00" for h in range(24)]
