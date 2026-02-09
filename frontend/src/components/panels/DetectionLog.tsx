'use client';

import { useTrackingStore } from '@/stores/trackingStore';

export default function DetectionLog() {
    const detections = useTrackingStore((state) => state.detections);

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'alert':
                return (
                    <svg className="w-4 h-4 text-[#ef4444]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                    </svg>
                );
            case 'entry':
                return (
                    <svg className="w-4 h-4 text-[#137fec]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
                    </svg>
                );
        }
    };

    const getEventStyle = (type: string) => {
        if (type === 'alert') {
            return 'bg-[#ef4444]/5 border-[#ef4444]/20 hover:bg-[#ef4444]/10';
        }
        return 'border-[#283039] hover:bg-[#1a2027]';
    };

    return (
        <>
            <div className="p-4 border-b border-[#283039] flex justify-between items-center bg-[#1a2027]/30">
                <div>
                    <h3 className="text-white text-sm font-bold uppercase tracking-tight">Detection Log</h3>
                    <p className="text-gray-500 text-[9px] mt-0.5 uppercase">Live Event Stream</p>
                </div>
                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                </svg>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {detections.map((detection) => (
                    <div
                        key={detection.id}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${getEventStyle(detection.type)}`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                                {getEventIcon(detection.type)}
                                <span className={`font-bold text-[11px] uppercase ${detection.type === 'alert' ? 'text-[#ef4444]' : 'text-white'
                                    }`}>
                                    {detection.event}
                                </span>
                            </div>
                            <span className="text-gray-600 text-[10px] font-mono">{detection.timestamp}</span>
                        </div>
                        <p className="text-gray-400 text-[11px] mb-2">
                            ID #{detection.track_id} • {detection.location}
                        </p>
                        {detection.confidence && (
                            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${detection.type === 'alert' ? 'bg-[#ef4444]' : 'bg-[#137fec]'}`}
                                    style={{ width: `${detection.confidence * 100}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}
