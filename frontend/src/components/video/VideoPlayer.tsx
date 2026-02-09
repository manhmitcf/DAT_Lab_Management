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
        <div className="flex-1 relative rounded-xl overflow-hidden border border-[#283039] bg-black group">
            {/* Video Background (placeholder image) */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-70"
                style={{
                    backgroundImage: `url('https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80')`,
                }}
            ></div>

            {/* Person Bounding Boxes & Skeletons */}
            <div className="absolute inset-0 pointer-events-none">
                {persons.map((person) => (
                    <BoundingBox key={person.track_id} person={person} showSkeleton={true} />
                ))}
            </div>

            {/* Top Right Controls */}
            <div className="absolute top-4 right-4 flex gap-2">
                <button
                    className="bg-black/60 backdrop-blur-md text-white size-10 rounded-lg border border-white/10 flex items-center justify-center hover:bg-[#137fec] transition-colors"
                    title="Toggle Overlays"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    </svg>
                </button>
                <button
                    className="bg-black/60 backdrop-blur-md text-white size-10 rounded-lg border border-white/10 flex items-center justify-center hover:bg-[#283039] transition-colors"
                    title="Fullscreen"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                    </svg>
                </button>
            </div>

            {/* Top Left Location Badge */}
            <div className="absolute top-4 left-4">
                <div className="bg-black/70 backdrop-blur-sm text-[11px] text-white px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                    <span className="size-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="font-bold uppercase tracking-widest font-mono">{location}</span>
                </div>
            </div>

            {/* Bottom Metadata Bar */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                {/* Left: Metadata Stats */}
                <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 flex gap-4">
                    <div>
                        <p className="text-[9px] text-gray-400 uppercase font-bold">Metadata Rate</p>
                        <p className="text-xs font-mono text-white">{stats.metadata_rate} msg/s</p>
                    </div>
                    <div className="w-px bg-white/10 h-8"></div>
                    <div>
                        <p className="text-[9px] text-gray-400 uppercase font-bold">Inference</p>
                        <p className="text-xs font-mono text-white">{stats.inference_time}ms</p>
                    </div>
                </div>

                {/* Right: Timestamp */}
                <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10">
                    <p className="text-xs font-mono text-white tracking-widest">{currentTime}</p>
                </div>
            </div>
        </div>
    );
}
