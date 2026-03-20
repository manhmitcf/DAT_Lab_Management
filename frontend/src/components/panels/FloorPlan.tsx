'use client';

import { useTrackingStore } from '@/stores/trackingStore';

/**
 * 2D floor map — always renders /labmap.svg with marker overlay.
 * Independent of WebSocket connectivity; markers follow store.
 */
export default function FloorPlan() {
    const markers = useTrackingStore((state) => state.markers);
    const selectedPersonId = useTrackingStore((state) => state.selectedPersonId);
    const setSelectedPersonId = useTrackingStore((state) => state.setSelectedPersonId);

    return (
        <div className="flex h-full min-h-[260px] w-full flex-col bg-[#111418]">
            <div className="shrink-0 px-3 py-2 border-b border-[#2a3441] flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">2D map</p>
                <span className="text-[10px] font-mono text-gray-600">{markers.length} tracks</span>
            </div>

            <div className="flex-1 min-h-[220px] w-full min-w-0 flex items-center justify-center p-3 bg-[#0b0e11] overflow-auto">
                <div className="relative mx-auto max-h-[min(560px,calc(100vh-200px))] max-w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/labmap.svg"
                        alt="Laboratory floor plan"
                        width={483}
                        height={845}
                        loading="eager"
                        decoding="async"
                        draggable={false}
                        className="block h-auto w-auto max-w-full max-h-[min(560px,calc(100vh-200px))] object-contain select-none pointer-events-none"
                    />
                    <div className="absolute inset-0 z-10 pointer-events-none">
                        {markers.map((marker) => {
                            const isSelected = marker.id === selectedPersonId;
                            return (
                                <div
                                    key={marker.id}
                                    className="absolute group cursor-pointer -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                                    style={{ top: `${marker.y}%`, left: `${marker.x}%` }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPersonId(marker.id);
                                    }}
                                >
                                    <div
                                        className={`size-3 rounded-full transition-all duration-300 border-2 border-[#0b0e11] shadow-lg ${isSelected ? 'bg-sky-400 scale-125 ring-4 ring-sky-400/30' : 'bg-sky-500 scale-100 hover:scale-125'}`}
                                    />
                                    {marker.label && (
                                        <div className="absolute top-4 -left-4 hidden group-hover:block bg-[#1B2431] border border-[#2a3441] px-2 py-1 rounded-md text-[10px] whitespace-nowrap z-20 text-white shadow-xl">
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
