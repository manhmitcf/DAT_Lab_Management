import { useState } from 'react';
import { useTrackingStore } from '@/stores/trackingStore';
import { FloorPlanMarker } from '@/types';

export default function FloorPlan() {
    const markers = useTrackingStore((state) => state.markers);
    const selectedPersonId = useTrackingStore((state) => state.selectedPersonId);
    const setSelectedPersonId = useTrackingStore((state) => state.setSelectedPersonId);
    const [isFullscreen, setIsFullscreen] = useState(false);

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

    const renderMap = (isFull: boolean = false) => (
        <div className={`relative inline-flex max-w-full max-h-full ${isFull ? 'scale-150 transition-transform duration-500' : ''}`}>
            {/* SVG Map Background */}
            <img
                src="/labmap.svg"
                alt="Laboratory Floor Plan"
                className="block max-w-full max-h-full object-contain drop-shadow-sm pointer-events-none"
            />

            {/* Markers Overlay */}
            <div className="absolute inset-0 z-10 w-full h-full">
                {markers.map((marker) => (
                    <div
                        key={marker.id}
                        className="absolute group cursor-pointer -translate-x-1/2 -translate-y-1/2"
                        style={{ top: `${marker.y}%`, left: `${marker.x}%` }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPersonId(marker.id);
                        }}
                    >
                        <div className={`size-3 rounded-full transition-transform hover:scale-150 ${getMarkerStyle(marker)}`} />
                        {marker.label && (
                            <div className="absolute top-4 -left-4 hidden group-hover:block bg-surface-0/95 border border-border-default px-2 py-1 rounded-[var(--radius-sm)] text-[10px] whitespace-nowrap z-20 shadow-md text-text-primary">
                                {marker.label}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="flex-1 rounded-[var(--radius-lg)] bg-surface-1 border border-border-default flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-border-default bg-surface-2/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent text-base">map</span>
                    <span className="text-xs font-semibold uppercase text-text-secondary tracking-wide">Floor 1 Overview</span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => setIsFullscreen(true)}
                        className="size-7 rounded-[var(--radius-sm)] bg-surface-3 hover:bg-accent transition-colors flex items-center justify-center text-text-secondary hover:text-white group"
                        aria-label="Full screen"
                    >
                        <span className="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">fullscreen</span>
                    </button>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative bg-surface-0 p-4 overflow-hidden flex items-center justify-center">
                {renderMap()}
            </div>

            {/* Fullscreen Overlay */}
            {isFullscreen && (
                <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col animate-fade-in backdrop-blur-sm">
                    <div className="p-4 flex justify-between items-center bg-surface-1/10 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-accent">map</span>
                            <span className="text-white font-bold uppercase tracking-widest text-sm">Floor Plan View</span>
                        </div>
                        <button
                            onClick={() => setIsFullscreen(false)}
                            className="size-10 rounded-full bg-white/10 hover:bg-danger transition-colors flex items-center justify-center text-white"
                        >
                            <span className="material-symbols-outlined text-2xl">close</span>
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-10 flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--surface-2)_0%,_transparent_100%)]">
                        <div className="max-w-[90vw] max-h-[80vh] flex items-center justify-center">
                            {renderMap(true)}
                        </div>
                    </div>
                    <div className="p-6 bg-surface-1/10 backdrop-blur-md flex justify-center gap-10">
                        <div className="flex items-center gap-2">
                            <span className="size-3 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
                            <span className="text-xs text-white/70 uppercase tracking-widest">Active Track</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="size-3 rounded-full bg-danger shadow-[0_0_10px_var(--danger)]" />
                            <span className="text-xs text-white/70 uppercase tracking-widest">Alert Event</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend (Small) */}
            {!isFullscreen && (
                <div className="p-2.5 bg-surface-0/80 border-t border-border-default">
                    <div className="flex items-center justify-center gap-6">
                        <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-accent" />
                            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Active</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-danger" />
                            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Incident</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
