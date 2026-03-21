'use client';

import { useTrackingStore } from '@/stores/trackingStore';

/**
 * Full-bleed 2D floor map — no outer card; uses all space from parent.
 */
export default function FloorPlan() {
    const markers = useTrackingStore((state) => state.markers);
    const selectedPersonId = useTrackingStore((state) => state.selectedPersonId);
    const setSelectedPersonId = useTrackingStore((state) => state.setSelectedPersonId);

    return (
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col bg-[#0b0e11]">
            <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-1">
                <div
                    className="relative flex items-center justify-center"
                    style={{ aspectRatio: '483/845', maxWidth: '100%', maxHeight: '100%' }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/labmap.svg"
                        alt="Laboratory floor plan"
                        width={483}
                        height={845}
                        loading="eager"
                        decoding="async"
                        draggable={false}
                        className="block w-full h-full object-contain select-none pointer-events-none"
                    />
                    <div className="pointer-events-none absolute inset-0">
                        {markers.map((marker) => {
                            const isSelected = marker.id === selectedPersonId;
                            return (
                                <div
                                    key={marker.id}
                                    className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                                    style={{ top: `${marker.y}%`, left: `${marker.x}%` }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPersonId(marker.id);
                                    }}
                                >
                                    <div
                                        className={`size-3 rounded-full border-2 border-[#0b0e11] shadow-lg transition-all duration-300 ${isSelected ? 'scale-125 bg-sky-400 ring-4 ring-sky-400/30' : 'bg-sky-500 hover:scale-125'}`}
                                    />
                                    {marker.label && (
                                        <div className="absolute top-4 -left-4 z-20 hidden rounded-md border border-[#2a3441] bg-[#1B2431] px-2 py-1 text-[10px] whitespace-nowrap text-white shadow-xl group-hover:block">
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
