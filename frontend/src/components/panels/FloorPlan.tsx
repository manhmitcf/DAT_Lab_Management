'use client';

import type { MouseEvent } from 'react';
import { useTrackingStore } from '@/stores/trackingStore';

export default function FloorPlan() {
    const markers = useTrackingStore((state) => state.markers);
    const selectedPersonId = useTrackingStore((state) => state.selectedPersonId);
    const setSelectedPersonId = useTrackingStore((state) => state.setSelectedPersonId);

    return (
        <div className="flex-1 flex flex-col min-h-0 w-full bg-surface-0 p-2 relative overflow-hidden group/fp">
            <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2 px-1">
                2D floor map
            </p>
            <div className="flex-1 min-h-[200px] min-h-0 flex items-center justify-center w-full overflow-auto">
                <div className="relative inline-block max-w-full max-h-full">
                    <img
                        src="/labmap.svg"
                        alt="Laboratory Floor Plan"
                        width={483}
                        height={845}
                        draggable={false}
                        className="block max-w-full max-h-[min(100%,70vh)] w-auto h-auto object-contain drop-shadow-sm pointer-events-none select-none"
                    />
                    <div className="absolute inset-0 z-10">
                        {markers.map((marker) => {
                            const isSelected = marker.id === selectedPersonId;
                            return (
                                <div
                                    key={marker.id}
                                    className="absolute group cursor-pointer -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                                    style={{ top: `${marker.y}%`, left: `${marker.x}%` }}
                                    onClick={(e: MouseEvent) => {
                                        e.stopPropagation();
                                        setSelectedPersonId(marker.id);
                                    }}
                                >
                                    <div
                                        className={`size-3 rounded-full transition-all duration-300 border-2 border-surface-0 shadow-lg ${isSelected ? 'bg-accent-strong scale-125 ring-4 ring-accent/30' : 'bg-accent scale-100 hover:scale-125'}`}
                                    />
                                    {marker.label && (
                                        <div className="absolute top-4 -left-4 hidden group-hover:block bg-surface-0/95 border border-border-default px-2 py-1 rounded-[var(--radius-sm)] text-[10px] whitespace-nowrap z-20 shadow-xl text-text-primary translate-y-1 animate-in fade-in slide-in-from-top-1">
                                            {marker.label}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
