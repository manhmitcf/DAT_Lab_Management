"""
Seed fake FrameData and ObjectDetection for analytics testing.
Run: python manage.py seed_analytics_data
"""
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from Lab_Management.models import FrameData, ObjectDetection


class Command(BaseCommand):
    help = 'Seed fake analytics data (FrameData + ObjectDetection) for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing FrameData before seeding',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='Number of days to generate data (default: 7)',
        )

    def handle(self, *args, **options):
        if options['clear']:
            deleted, _ = FrameData.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Deleted {deleted} FrameData records'))

        now = timezone.now()
        days = options['days']

        frames_created = 0
        detections_created = 0
        track_id_counter = 1000

        for day_offset in range(days):
            base_date = (now - timedelta(days=day_offset)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            cum_in = 0
            cum_out = 0
            # Track IDs that persist across frames this day (for dwell)
            active_tracks = {}

            for hour in range(6, 21):
                ts = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
                if ts > now:
                    continue

                # Simulate people entering/leaving
                enter = random.randint(2, 8) if 8 <= hour <= 12 else random.randint(0, 4)
                leave = random.randint(1, 6) if 14 <= hour <= 18 else random.randint(0, 3)
                cum_in += enter
                cum_out += leave
                cum_out = min(cum_out, max(0, cum_in - 1))

                num_people = max(0, min(cum_in - cum_out, 12))
                alert = 'none' if num_people < 6 else ('warning' if num_people < 9 else 'critical')

                frame = FrameData.objects.create(
                    timestamp=ts,
                    count_in=cum_in,
                    count_out=cum_out,
                    occupancy=num_people,
                    fps=round(random.uniform(25, 35), 1),
                    alert=alert,
                    height_frame=720,
                    width_frame=1280,
                    height_2D=500,
                    width_2D=500,
                )
                frames_created += 1

                track_ids_this_frame = []
                for _ in range(num_people):
                    if active_tracks and random.random() < 0.35:
                        tid = random.choice(list(active_tracks.keys()))
                    else:
                        track_id_counter += 1
                        tid = track_id_counter
                        active_tracks[tid] = ts
                    track_ids_this_frame.append(tid)
                track_ids_this_frame = list(dict.fromkeys(track_ids_this_frame))
                while len(track_ids_this_frame) < num_people:
                    track_id_counter += 1
                    track_ids_this_frame.append(track_id_counter)

                for idx, tid in enumerate(track_ids_this_frame[:num_people]):
                    ObjectDetection.objects.create(
                        frame_data=frame,
                        track_id=tid,
                        bbox=[100 + idx * 80, 200, 150 + idx * 80, 350],
                        coordinates_2D=[120 + idx * 50, 250],
                    )
                    detections_created += 1

        self.stdout.write(self.style.SUCCESS(
            f'Created {frames_created} FrameData and {detections_created} ObjectDetection records'
        ))
