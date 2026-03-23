'use client';

import { cameraFeeds } from '@/lib/mockData';

interface CameraGridProps {
    layout: number;
}

export default function CameraGrid({ layout }: CameraGridProps) {
    const getGridClasses = () => {
        switch (layout) {
            case 1: return 'grid-cols-1 grid-rows-1';
            case 2: return 'grid-cols-2 grid-rows-1';
            case 4: return 'grid-cols-2 grid-rows-2';
            case 6: return 'grid-cols-3 grid-rows-2';
            case 9: return 'grid-cols-3 grid-rows-3';
            default: return 'grid-cols-2 grid-rows-2';
        }
    };

    const cameras = Array.from({ length: layout }, (_, i) => {
        const feed = cameraFeeds[i % cameraFeeds.length];
        return { ...feed, id: `${feed.id}-${i}`, name: `CAM-${String(i + 1).padStart(2, '0')}` };
    });

    return (
        <div className={`flex-1 grid gap-2 ${getGridClasses()} stagger-children`}>
            {cameras.map((camera) => (
                <div
                    key={camera.id}
                    className="relative rounded-[var(--radius-md)] overflow-hidden border border-border-default bg-black group cursor-pointer hover:border-border-strong transition-colors"
                >
                    {/* Video bg */}
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-75 group-hover:opacity-90 transition-opacity duration-300"
                        style={{ backgroundImage: `url("${camera.imageUrl}")` }}
                    />

                    {/* Top left: label */}
                    <div className="absolute top-2 left-2 flex items-center gap-2">
                        <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded-[var(--radius-sm)] text-[10px] font-mono text-text-primary flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-danger animate-pulse" />
                            {camera.name}
                        </div>
                        {layout === 1 && (
                            <div className="px-2 py-1 bg-accent/20 border border-accent/30 rounded-[var(--radius-sm)] text-[10px] font-mono text-accent-strong">
                                4K ULTRA HD
                            </div>
                        )}
                    </div>

                    {/* Bottom left: location */}
                    <div className="absolute bottom-2 left-2">
                        <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded-[var(--radius-sm)] text-[10px] text-text-secondary">
                            {camera.location}
                        </div>
                    </div>

                    {/* Top right: status */}
                    <div className="absolute top-2 right-2">
                        <div className={`size-3 rounded-full border-2 border-black/50 ${camera.status === 'online' ? 'bg-success' :
                                camera.status === 'heavy' ? 'bg-warning' : 'bg-danger'
                            }`} />
                    </div>

                    {/* Bottom right: actions on hover */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button className="size-8 rounded-[var(--radius-sm)] bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-accent transition-colors">
                            <span className="material-symbols-outlined text-sm">fullscreen</span>
                        </button>
                        <button className="size-8 rounded-[var(--radius-sm)] bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-accent transition-colors">
                            <span className="material-symbols-outlined text-sm">settings</span>
                        </button>
                    </div>

                    {/* Center play on hover (multi-view) */}
                    {layout > 1 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/15">
                            <button className="size-11 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-accent transition-colors active:scale-95">
                                <span className="material-symbols-outlined text-2xl">play_arrow</span>
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
