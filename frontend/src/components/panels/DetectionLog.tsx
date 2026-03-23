'use client';

import { useTrackingStore } from '@/stores/trackingStore';

export default function DetectionLog() {
    const detections = useTrackingStore((state) => state.detections);

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'alert': return 'warning';
            case 'entry': return 'location_on';
            default: return 'directions_walk';
        }
    };

    const getEventColor = (type: string) => {
        if (type === 'alert') return 'text-danger';
        if (type === 'entry') return 'text-accent';
        return 'text-text-tertiary';
    };

    return (
        <>
            <div className="p-4 border-b border-border-default flex justify-between items-center bg-surface-2/30">
                <div>
                    <h3 className="text-text-primary text-sm font-bold uppercase tracking-tight">Detection Log</h3>
                    <p className="text-text-tertiary text-[9px] mt-0.5 uppercase tracking-wider">Live Event Stream</p>
                </div>
                <span className="material-symbols-outlined text-text-tertiary text-xl">refresh</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 stagger-children">
                {detections.map((detection) => (
                    <div
                        key={detection.id}
                        className={`
                            p-3 rounded-[var(--radius-md)] border transition-colors cursor-pointer
                            ${detection.type === 'alert'
                                ? 'bg-danger-muted border-danger/20 hover:bg-danger/10'
                                : 'border-border-default hover:bg-surface-2'
                            }
                        `}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                                <span className={`material-symbols-outlined text-base ${getEventColor(detection.type)}`}>
                                    {getEventIcon(detection.type)}
                                </span>
                                <span className={`font-bold text-[11px] uppercase ${detection.type === 'alert' ? 'text-danger' : 'text-text-primary'
                                    }`}>
                                    {detection.event}
                                </span>
                            </div>
                            <span className="text-text-tertiary text-[10px] font-mono">{detection.timestamp}</span>
                        </div>
                        <p className="text-text-secondary text-[11px] mb-2">
                            ID #{detection.track_id} · {detection.location}
                        </p>
                        {detection.confidence && (
                            <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full animate-bar-fill ${detection.type === 'alert' ? 'bg-danger' : 'bg-accent'
                                        }`}
                                    style={{ width: `${detection.confidence * 100}%` }}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}
