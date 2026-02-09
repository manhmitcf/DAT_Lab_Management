'use client';

import { cameraFeeds } from '@/lib/mockData';

interface CameraGridProps {
    layout: number;
}

export default function CameraGrid({ layout }: CameraGridProps) {
    // Determine grid classes based on layout
    const getGridClasses = () => {
        switch (layout) {
            case 1:
                return 'grid-cols-1 grid-rows-1';
            case 2:
                return 'grid-cols-2 grid-rows-1';
            case 4:
                return 'grid-cols-2 grid-rows-2';
            case 6:
                return 'grid-cols-3 grid-rows-2';
            case 9:
                return 'grid-cols-3 grid-rows-3';
            default:
                return 'grid-cols-2 grid-rows-2';
        }
    };

    // Get cameras to display (repeat if needed)
    const cameras = Array.from({ length: layout }, (_, i) => {
        const feed = cameraFeeds[i % cameraFeeds.length];
        return {
            ...feed,
            id: `${feed.id}-${i}`,
            name: `CAM-${String(i + 1).padStart(2, '0')}`,
        };
    });

    return (
        <div className={`flex-1 grid gap-2 ${getGridClasses()}`}>
            {cameras.map((camera, index) => (
                <div
                    key={camera.id}
                    className="relative rounded-lg overflow-hidden border border-[#2a3441] bg-black group cursor-pointer"
                >
                    {/* Video Background */}
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-80 group-hover:opacity-100 transition-opacity"
                        style={{ backgroundImage: `url("${camera.imageUrl}")` }}
                    />

                    {/* Camera Label - Top Left */}
                    <div className="absolute top-2 left-2 flex items-center gap-2">
                        <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-[10px] font-mono text-white flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            {camera.name}
                        </div>
                        {layout === 1 && (
                            <div className="px-2 py-1 bg-[#137fec]/20 border border-[#137fec]/30 rounded text-[10px] font-mono text-[#137fec]">
                                4K ULTRA HD
                            </div>
                        )}
                    </div>

                    {/* Location - Bottom Left */}
                    <div className="absolute bottom-2 left-2">
                        <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-[10px] text-gray-300">
                            {camera.location}
                        </div>
                    </div>

                    {/* Status Indicator - Top Right */}
                    <div className="absolute top-2 right-2">
                        <div className={`size-3 rounded-full border-2 border-black/50 ${camera.status === 'online' ? 'bg-green-500' :
                                camera.status === 'heavy' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></div>
                    </div>

                    {/* Fullscreen button - Bottom Right (on hover) */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button className="size-8 rounded bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-[#137fec] transition-colors">
                            <span className="material-symbols-outlined text-sm">fullscreen</span>
                        </button>
                        <button className="size-8 rounded bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-[#137fec] transition-colors">
                            <span className="material-symbols-outlined text-sm">settings</span>
                        </button>
                    </div>

                    {/* Center Play Button (on hover for single view) */}
                    {layout > 1 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                            <button className="size-12 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-[#137fec] transition-colors">
                                <span className="material-symbols-outlined text-2xl">play_arrow</span>
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
