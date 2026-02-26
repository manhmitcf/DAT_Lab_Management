'use client';

import { useTrackingStore } from '@/stores/trackingStore';
import BoundingBox from './BoundingBox';

interface VideoPlayerProps {
    cameraId?: string;
    cameraName?: string;
    location?: string;
}

export default function VideoPlayer({
    cameraId = 'HQ-North-01',
    cameraName = 'Primary Camera Feed',
    location = 'NORTH ENTRANCE HALL'
}: VideoPlayerProps) {
    const persons = useTrackingStore((state) => state.persons);
    const stats = useTrackingStore((state) => state.stats);
    const currentTime = new Date().toISOString().replace('T', ' ').slice(0, 23);

    return (
        <div className="flex-1 relative rounded-[var(--radius-lg)] overflow-hidden border border-border-default bg-black group">
            {/* Video bg */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-70"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80')` }}
            />

            {/* Bounding boxes */}
            <div className="absolute inset-0 pointer-events-none">
                {persons.map((person) => (
                    <BoundingBox key={person.track_id} person={person} showSkeleton={true} />
                ))}
            </div>

            {/* Top right controls */}
            <div className="absolute top-4 right-4 flex gap-2">
                <button
                    className="bg-black/60 backdrop-blur-md text-white size-10 rounded-[var(--radius-md)] border border-white/10 flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label="Toggle Overlays"
                >
                    <span className="material-symbols-outlined text-xl">visibility</span>
                </button>
                <button
                    className="bg-black/60 backdrop-blur-md text-white size-10 rounded-[var(--radius-md)] border border-white/10 flex items-center justify-center hover:bg-surface-4 transition-colors"
                    aria-label="Fullscreen"
                >
                    <span className="material-symbols-outlined text-xl">fullscreen</span>
                </button>
            </div>

            {/* Top left badge */}
            <div className="absolute top-4 left-4">
                <div className="bg-black/70 backdrop-blur-sm text-[11px] text-text-primary px-3 py-1.5 rounded-[var(--radius-md)] border border-white/10 flex items-center gap-2">
                    <span className="size-2 bg-danger rounded-full animate-pulse" />
                    <span className="font-bold uppercase tracking-widest font-mono">{location}</span>
                </div>
            </div>

            {/* Bottom metadata */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                <div className="bg-black/60 backdrop-blur-md p-3 rounded-[var(--radius-md)] border border-white/10 flex gap-4">
                    <div>
                        <p className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">Metadata Rate</p>
                        <p className="text-xs font-mono text-text-primary">{stats.metadata_rate} msg/s</p>
                    </div>
                    <div className="w-px bg-white/10 h-8" />
                    <div>
                        <p className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">Inference</p>
                        <p className="text-xs font-mono text-text-primary">{stats.inference_time}ms</p>
                    </div>
                </div>
                <div className="bg-black/60 backdrop-blur-md p-3 rounded-[var(--radius-md)] border border-white/10">
                    <p className="text-xs font-mono text-text-primary tracking-widest">{currentTime}</p>
                </div>
            </div>
        </div>
    );
}
