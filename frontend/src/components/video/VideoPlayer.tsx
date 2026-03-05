'use client';

import { useTrackingStore } from '@/stores/trackingStore';

export default function VideoPlayer() {
    const currentFrame = useTrackingStore((state) => state.currentFrame);
    const wsStatus = useTrackingStore((state) => state.wsStatus);

    const isConnecting = wsStatus === 'connecting';
    const isDisconnected = wsStatus === 'disconnected' || wsStatus === 'error';

    return (
        <div className="flex-1 relative rounded-[var(--radius-lg)] overflow-hidden bg-black">
            {currentFrame ? (
                <img
                    src={currentFrame}
                    alt="Live camera feed"
                    className="absolute inset-0 w-full h-full object-contain"
                    draggable={false}
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    {isConnecting ? (
                        <>
                            <span className="material-symbols-outlined text-4xl text-accent animate-spin">
                                progress_activity
                            </span>
                            <p className="text-text-tertiary text-xs font-mono uppercase tracking-widest">
                                Connecting to camera…
                            </p>
                        </>
                    ) : isDisconnected ? (
                        <>
                            <span className="material-symbols-outlined text-4xl text-danger">
                                videocam_off
                            </span>
                            <p className="text-text-tertiary text-xs font-mono uppercase tracking-widest">
                                No signal — reconnecting…
                            </p>
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-4xl text-text-tertiary">
                                videocam
                            </span>
                            <p className="text-text-tertiary text-xs font-mono uppercase tracking-widest">
                                Waiting for stream…
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
