import { useTrackingStore } from '@/stores/trackingStore';
import { FloorPlanMarker } from '@/types';

export default function FloorPlan() {
    const markers = useTrackingStore((state) => state.markers);
    const selectedPersonId = useTrackingStore((state) => state.selectedPersonId);
    const setSelectedPersonId = useTrackingStore((state) => state.setSelectedPersonId);

    return (
        <div className="flex-1 bg-surface-0 flex flex-col items-center justify-center p-2 relative overflow-hidden group/fp">
            <div className="relative inline-flex max-w-full max-h-full">
                {/* SVG Map Background */}
                <img
                    src="/labmap.svg"
                    alt="Laboratory Floor Plan"
                    className="block max-w-full max-h-full object-contain drop-shadow-sm pointer-events-none"
                />

                {/* Markers Overlay */}
                <div className="absolute inset-0 z-10 w-full h-full">
                    {markers.map((marker) => {
                        const isSelected = marker.id === selectedPersonId;
                        return (
                            <div
                                key={marker.id}
                                className="absolute group cursor-pointer -translate-x-1/2 -translate-y-1/2"
                                style={{ top: `${marker.y}%`, left: `${marker.x}%` }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPersonId(marker.id);
                                }}
                            >
                                <div className={`size-3 rounded-full transition-all duration-300 border-2 border-surface-0 shadow-lg ${isSelected ? 'bg-accent-strong scale-125 ring-4 ring-accent/30' : 'bg-accent scale-100 hover:scale-125'}`} />
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
    );
}
