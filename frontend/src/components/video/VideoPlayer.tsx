'use client';

import { useEffect, useState } from 'react';
import { useJanusStream } from '@/hooks/useJanusStream';
import { JANUS_URL } from '@/config/api';
import { formatVietnamDateTime } from '@/lib/formatDateTime';
import { useTrackingStore } from '@/stores/trackingStore';

/** Optional MJPEG or still image when video is not sent on the metadata WebSocket (non-Janus path). */
const CAMERA_STREAM_URL = process.env.NEXT_PUBLIC_CAMERA_STREAM_URL ?? '';

export default function VideoPlayer() {
    const { videoRef, status: janusStatus, error: janusError } = useJanusStream();
    const currentFrame = useTrackingStore((state) => state.currentFrame);
    const wsStatus = useTrackingStore((state) => state.wsStatus);
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 100);
        return () => clearInterval(id);
    }, []);
    const currentTime = formatVietnamDateTime(now);

    const isConnecting = wsStatus === 'connecting';
    const isDisconnected = wsStatus === 'disconnected' || wsStatus === 'error';
    const metadataConnected = wsStatus === 'connected';

    const useJanus = !!JANUS_URL;
    const videoSrc = !useJanus ? (currentFrame || CAMERA_STREAM_URL || null) : null;

    const janusConnected = janusStatus === 'connected';
    const janusConnecting = ['loading', 'connecting'].includes(janusStatus);
    const janusFailed = janusStatus === 'error';

    return (
        <div className="flex-1 min-h-[180px] min-w-0 relative rounded-[var(--radius-lg)] overflow-hidden bg-black">
            {useJanus ? (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`absolute inset-0 w-full h-full object-contain ${janusConnected ? '' : 'hidden'}`}
                    />
                    {!janusConnected && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            {janusConnecting ? (
                                <>
                                    <span className="material-symbols-outlined text-4xl text-accent animate-spin">
                                        progress_activity
                                    </span>
                                    <p className="text-text-tertiary text-xs font-mono uppercase tracking-widest">
                                        Connecting to Janus…
                                    </p>
                                </>
                            ) : janusFailed ? (
                                <>
                                    <span className="material-symbols-outlined text-4xl text-danger">
                                        videocam_off
                                    </span>
                                    <p className="text-text-tertiary text-xs font-mono uppercase tracking-widest">
                                        {janusError || 'Janus error'}
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
                </>
            ) : videoSrc ? (
                <img
                    src={videoSrc}
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
                                Connecting to metadata…
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
                    ) : metadataConnected ? (
                        <>
                            <span className="material-symbols-outlined text-4xl text-text-tertiary">
                                hub
                            </span>
                            <p className="text-text-tertiary text-xs font-mono uppercase tracking-widest text-center max-w-[280px]">
                                Metadata live — set NEXT_PUBLIC_CAMERA_STREAM_URL or WebRTC for video
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

            {/* Timestamp — bottom right */}
            <div className="absolute bottom-4 right-4 z-10">
                <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-[var(--radius-md)] border border-white/10">
                    <p className="text-xs font-mono text-text-primary tracking-widest">{currentTime}</p>
                </div>
            </div>
        </div>
    );
}
