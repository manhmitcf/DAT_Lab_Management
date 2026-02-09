'use client';

import { useTrackingStore } from '@/stores/trackingStore';
import { FloorPlanMarker } from '@/types';

export default function FloorPlan() {
    const markers = useTrackingStore((state) => state.markers);
    const selectedPersonId = useTrackingStore((state) => state.selectedPersonId);
    const setSelectedPersonId = useTrackingStore((state) => state.setSelectedPersonId);

    const getMarkerStyle = (marker: FloorPlanMarker) => {
        const isSelected = marker.id === selectedPersonId;

        if (marker.type === 'alert') {
            return `bg-[#ef4444] ${isSelected ? 'ring-2 ring-[#ef4444]/50' : ''} animate-pulse`;
        }
        if (marker.type === 'active') {
            return `bg-[#137fec] ${isSelected ? 'ring-2 ring-[#137fec]/50' : ''} map-marker`;
        }
        return 'bg-gray-400 opacity-60';
    };

    return (
        <div className="flex-1 rounded-xl bg-[#111418] border border-[#283039] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-[#283039] bg-[#1a2027]/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#137fec]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z" />
                    </svg>
                    <span className="text-xs font-bold uppercase text-gray-300">Floor 1 Overview</span>
                </div>
                <div className="flex gap-1">
                    <button className="size-6 rounded bg-[#283039] hover:bg-[#137fec] transition-colors flex items-center justify-center">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                    </button>
                    <button className="size-6 rounded bg-[#283039] hover:bg-[#137fec] transition-colors flex items-center justify-center">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 13H5v-2h14v2z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Floor Plan Area */}
            <div className="flex-1 relative bg-[#0b0e11] floor-plan-grid p-6 overflow-hidden">
                {/* Building outline */}
                <div className="absolute inset-10 border-4 border-gray-800/50 rounded-lg pointer-events-none">
                    <div className="absolute top-0 left-1/2 w-1 h-20 bg-gray-800/50"></div>
                    <div className="absolute bottom-0 left-1/4 w-1 h-32 bg-gray-800/50"></div>
                    <div className="absolute right-0 top-1/2 h-1 w-24 bg-gray-800/50"></div>
                </div>

                {/* Person Markers */}
                {markers.map((marker) => (
                    <div
                        key={marker.id}
                        className="absolute group cursor-pointer"
                        style={{ top: `${marker.y}%`, left: `${marker.x}%` }}
                        onClick={() => setSelectedPersonId(marker.id)}
                    >
                        <div className={`size-3 rounded-full ${getMarkerStyle(marker)}`}></div>
                        {marker.label && (
                            <div className="absolute top-4 -left-4 hidden group-hover:block bg-black/90 border border-[#283039] px-2 py-1 rounded text-[10px] whitespace-nowrap z-10">
                                {marker.label}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="p-3 bg-[#0d1014] border-t border-[#283039]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-[#137fec] shadow-[0_0_5px_#137fec]"></span>
                        <span className="text-[10px] text-gray-400 uppercase">Active Entity</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-[#ef4444] shadow-[0_0_5px_#ef4444]"></span>
                        <span className="text-[10px] text-gray-400 uppercase">Incident</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
