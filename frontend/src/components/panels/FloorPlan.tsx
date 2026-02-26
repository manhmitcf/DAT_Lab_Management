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
            return `bg-danger ${isSelected ? 'ring-2 ring-danger/50' : ''} animate-pulse`;
        }
        if (marker.type === 'active') {
            return `bg-accent ${isSelected ? 'ring-2 ring-accent/50' : ''} map-marker`;
        }
        return 'bg-text-tertiary opacity-60';
    };

    return (
        <div className="flex-1 rounded-[var(--radius-lg)] bg-surface-1 border border-border-default flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-border-default bg-surface-2/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent text-base">map</span>
                    <span className="text-xs font-semibold uppercase text-text-secondary tracking-wide">Floor 1 Overview</span>
                </div>
                <div className="flex gap-1">
                    <button className="size-6 rounded-[var(--radius-sm)] bg-surface-3 hover:bg-accent transition-colors flex items-center justify-center text-text-secondary hover:text-white" aria-label="Zoom in">
                        <span className="material-symbols-outlined text-base">add</span>
                    </button>
                    <button className="size-6 rounded-[var(--radius-sm)] bg-surface-3 hover:bg-accent transition-colors flex items-center justify-center text-text-secondary hover:text-white" aria-label="Zoom out">
                        <span className="material-symbols-outlined text-base">remove</span>
                    </button>
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 relative bg-surface-0 floor-plan-grid p-6 overflow-hidden">
                <div className="absolute inset-10 border-4 border-border-subtle rounded-[var(--radius-md)] pointer-events-none">
                    <div className="absolute top-0 left-1/2 w-1 h-20 bg-border-subtle" />
                    <div className="absolute bottom-0 left-1/4 w-1 h-32 bg-border-subtle" />
                    <div className="absolute right-0 top-1/2 h-1 w-24 bg-border-subtle" />
                </div>

                {markers.map((marker) => (
                    <div
                        key={marker.id}
                        className="absolute group cursor-pointer"
                        style={{ top: `${marker.y}%`, left: `${marker.x}%` }}
                        onClick={() => setSelectedPersonId(marker.id)}
                    >
                        <div className={`size-3 rounded-full transition-transform hover:scale-150 ${getMarkerStyle(marker)}`} />
                        {marker.label && (
                            <div className="absolute top-4 -left-4 hidden group-hover:block bg-surface-0/95 border border-border-default px-2 py-1 rounded-[var(--radius-sm)] text-[10px] whitespace-nowrap z-10 shadow-md text-text-primary">
                                {marker.label}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="p-2.5 bg-surface-0/80 border-t border-border-default">
                <div className="flex items-center justify-center gap-6">
                    <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-accent shadow-[0_0_5px_var(--accent)]" />
                        <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Active</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-danger shadow-[0_0_5px_var(--danger)]" />
                        <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Incident</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
