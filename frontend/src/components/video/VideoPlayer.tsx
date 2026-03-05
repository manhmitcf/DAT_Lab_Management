'use client';

import { useTrackingStore } from '@/stores/trackingStore';
import BoundingBox from './BoundingBox';

interface VideoPlayerProps {
    cameraName?: string;
    location?: string;
}

export default function VideoPlayer({
    cameraName = 'Primary Camera Feed',
    location = 'NORTH ENTRANCE HALL',
}: VideoPlayerProps) {
    const persons = useTrackingStore((state) => state.persons);
    const stats = useTrackingStore((state) => state.stats);
    const currentFrame = useTrackingStore((state) => state.currentFrame);
    const wsStatus = useTrackingStore((state) => state.wsStatus);
    const alertLevel = useTrackingStore((state) => state.alertLevel);
    const currentTime = new Date().toISOString().replace('T', ' ').slice(0, 23);

    const alertBorderColor =
        alertLevel === 'critical'
            ? 'border-danger'
            : alertLevel === 'warning'
              ? 'border-warning'
              : alertLevel === 'info'
                ? 'border-accent'
                : 'border-border-default';

    const isConnecting = wsStatus === 'connecting';
    const isDisconnected = wsStatus === 'disconnected' || wsStatus === 'error';

    return (
        <div
            className={`flex-1 relative rounded-[var(--radius-lg)] overflow-hidden border-2 bg-black group transition-colors ${alertBorderColor}`}
        >
            {/* Video background — WS frame or placeholder */}
            {currentFrame ? (
                <img
                    src={currentFrame}
                    alt={cameraName}
                    className="absolute inset-0 w-full h-full object-cover"
                    draggable={false}
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-1 gap-3">
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

            {/* Bounding boxes overlay */}
            {currentFrame && (
                <div className="absolute inset-0 pointer-events-none">
                    {persons.map((person) => (
                        <BoundingBox key={person.track_id} person={person} showSkeleton={false} />
                    ))}
                </div>
            )}

            {/* Top right controls */}
            <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button
                    className="bg-black/60 backdrop-blur-md text-white size-10 rounded-[var(--radius-md)] border border-white/10 flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label="Toggle Overlays"
                >
                    <span className="material-symbols-outlined text-xl">visibility</span>
                </button>
                <button
                    className="bg-black/60 backdrop-blur-md text-white size-10 rounded-[var(--radius-md)] border border-white/10 flex items-center justify-center hover:bg-surface-4 transition-colors"
                    aria-label="Fullscreen"
                >
                    <span className="material-symbols-outlined text-xl">fullscreen</span>
                </button>
            </div>

            {/* Top left: location + WS status badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
                <div className="bg-black/70 backdrop-blur-sm text-[11px] text-text-primary px-3 py-1.5 rounded-[var(--radius-md)] border border-white/10 flex items-center gap-2">
                    <span
                        className={`size-2 rounded-full ${
                            wsStatus === 'connected'
                                ? 'bg-danger animate-pulse'
                                : wsStatus === 'connecting'
                                  ? 'bg-warning animate-pulse'
                                  : 'bg-surface-4'
                        }`}
                    />
                    <span className="font-bold uppercase tracking-widest font-mono">{location}</span>
                </div>
                {alertLevel !== 'none' && (
                    <div
                        className={`px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-bold uppercase tracking-widest font-mono border ${
                            alertLevel === 'critical'
                                ? 'bg-danger/20 border-danger/50 text-danger'
                                : alertLevel === 'warning'
                                  ? 'bg-warning/20 border-warning/50 text-warning'
                                  : 'bg-accent/20 border-accent/50 text-accent'
                        }`}
                    >
                        {alertLevel}
                    </div>
                )}
            </div>

            {/* Bottom metadata */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end z-10">
                <div className="bg-black/60 backdrop-blur-md p-3 rounded-[var(--radius-md)] border border-white/10 flex gap-4">
                    <div>
                        <p className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">
                            FPS
                        </p>
                        <p className="text-xs font-mono text-text-primary">{stats.fps || '—'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">
                            Objects
                        </p>
                        <p className="text-xs font-mono text-text-primary">{persons.length}</p>
                    </div>
                </div>
                <div className="bg-black/60 backdrop-blur-md p-3 rounded-[var(--radius-md)] border border-white/10">
                    <p className="text-xs font-mono text-text-primary tracking-widest">{currentTime}</p>
                </div>
            </div>
        </div>
    );
}
