'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTrackingStore } from '@/stores/trackingStore';

const API_BASE =
    'https://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net';

interface NormPoint { x: number; y: number; }
interface PointPair { id: number; camera: NormPoint; floorPlan: NormPoint; }
type Step = 'idle' | 'pick_camera' | 'pick_floor';

const DOT_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

// ── Sub-component: the interactive dual canvas ────────────────────────────────
function CalibrationCanvas({
    pairs, step, pendingCamera,
    onCameraClick, onFloorClick,
    currentFrame, wsStatus,
}: {
    pairs: PointPair[];
    step: Step;
    pendingCamera: NormPoint | null;
    onCameraClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    onFloorClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    currentFrame: string | null;
    wsStatus: string;
}) {
    const color = (i: number) => DOT_COLORS[i % DOT_COLORS.length];

    return (
        <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">
            {/* ── Camera frame ── */}
            <div className="flex flex-col gap-2 min-h-0">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider shrink-0">
                    Camera Frame
                    {wsStatus !== 'connected' && (
                        <span className="ml-2 text-warning normal-case font-normal">(no stream)</span>
                    )}
                </p>
                <div
                    className={`relative rounded-[var(--radius-lg)] overflow-hidden bg-black border-2 transition-all select-none flex-1
                        ${step === 'pick_camera'
                            ? 'border-accent cursor-crosshair ring-4 ring-accent/20'
                            : 'border-border-default cursor-default'}`}
                    onClick={onCameraClick}
                >
                    {currentFrame ? (
                        <img src={currentFrame} alt="Camera" draggable={false}
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-4xl text-text-tertiary">videocam_off</span>
                            <p className="text-xs text-text-tertiary">No live frame</p>
                        </div>
                    )}

                    {/* Placed points */}
                    {pairs.map((p, i) => (
                        <div key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                            style={{ left: `${p.camera.x * 100}%`, top: `${p.camera.y * 100}%` }}>
                            <DotLabel index={i + 1} color={color(i)} />
                        </div>
                    ))}

                    {/* Pending preview */}
                    {step === 'pick_floor' && pendingCamera && (
                        <div className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 animate-pulse"
                            style={{ left: `${pendingCamera.x * 100}%`, top: `${pendingCamera.y * 100}%` }}>
                            <DotLabel index={pairs.length + 1} color={color(pairs.length)} />
                        </div>
                    )}

                    {step === 'pick_camera' && (
                        <div className="absolute inset-0 bg-accent/5 flex items-center justify-center pointer-events-none">
                            <span className="material-symbols-outlined text-accent/40 text-7xl">add_circle</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Floor plan ── */}
            <div className="flex flex-col gap-2 min-h-0">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider shrink-0">
                    Floor Plan
                </p>
                <div
                    className={`relative rounded-[var(--radius-lg)] overflow-hidden bg-surface-0 border-2 transition-all select-none flex-1
                        ${step === 'pick_floor'
                            ? 'border-accent cursor-crosshair ring-4 ring-accent/20'
                            : 'border-border-default cursor-default'}`}
                    onClick={onFloorClick}
                >
                    <img src="/labmap.svg" alt="Floor Plan" draggable={false}
                        className="absolute inset-0 w-full h-full object-contain bg-surface-1 pointer-events-none" />

                    {pairs.map((p, i) => (
                        <div key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                            style={{ left: `${p.floorPlan.x * 100}%`, top: `${p.floorPlan.y * 100}%` }}>
                            <DotLabel index={i + 1} color={color(i)} />
                        </div>
                    ))}

                    {step === 'pick_floor' && (
                        <div className="absolute inset-0 bg-accent/5 flex items-center justify-center pointer-events-none">
                            <span className="material-symbols-outlined text-accent/40 text-7xl">add_circle</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DotLabel({ index, color }: { index: number; color: string }) {
    return (
        <div className="size-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-xl"
            style={{ backgroundColor: color }}>
            {index}
        </div>
    );
}

// ── Fullscreen Modal ──────────────────────────────────────────────────────────
function CalibrationModal({ onClose }: { onClose: () => void }) {
    const currentFrame = useTrackingStore((s) => s.currentFrame);
    const wsStatus = useTrackingStore((s) => s.wsStatus);

    const [pairs, setPairs] = useState<PointPair[]>([]);
    const [step, setStep] = useState<Step>('idle');
    const [pendingCamera, setPendingCamera] = useState<NormPoint | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
    const nextId = useRef(1);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleCameraClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (step !== 'pick_camera') return;
        const rect = e.currentTarget.getBoundingClientRect();
        setPendingCamera({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
        setStep('pick_floor');
    }, [step]);

    const handleFloorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (step !== 'pick_floor' || !pendingCamera) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setPairs(prev => [...prev, {
            id: nextId.current++,
            camera: pendingCamera,
            floorPlan: { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height },
        }]);
        setPendingCamera(null);
        setStep('idle');
        setSaveResult(null);
    }, [step, pendingCamera]);

    const removePair = (id: number) => { setPairs(p => p.filter(x => x.id !== id)); setSaveResult(null); };
    const clearAll = () => { setPairs([]); setPendingCamera(null); setStep('idle'); setSaveResult(null); };

    const handleSave = async () => {
        if (pairs.length < 4) return;
        setSaving(true); setSaveResult(null);
        try {
            const res = await fetch(`${API_BASE}/api/lab_management/settings/mapping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    point_pairs: pairs.map(p => ({ src: [p.camera.x, p.camera.y], dst: [p.floorPlan.x, p.floorPlan.y] })),
                }),
            });
            setSaveResult(res.ok ? 'success' : 'error');
        } catch { setSaveResult('error'); }
        finally { setSaving(false); }
    };

    const fmt = (n: number) => (n * 100).toFixed(1) + '%';
    const color = (i: number) => DOT_COLORS[i % DOT_COLORS.length];

    const stepLabel: Record<Step, string | null> = {
        idle: null,
        pick_camera: '① Click a point on the camera frame',
        pick_floor: '② Click the corresponding point on the floor plan',
    };

    return (
        // Backdrop
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            {/* Modal panel */}
            <div className="bg-surface-1 border border-border-default rounded-[var(--radius-xl)] shadow-2xl w-full max-w-7xl flex flex-col"
                style={{ height: 'calc(100vh - 2rem)' }}>

                {/* ── Header ── */}
                <div className="shrink-0 flex items-center gap-4 px-6 py-4 border-b border-border-default">
                    <span className="material-symbols-outlined text-accent">map</span>
                    <div>
                        <h2 className="text-base font-bold text-text-primary">2D Mapping Calibration</h2>
                        <p className="text-xs text-text-tertiary">Select ≥ 4 point pairs to define the homography transform</p>
                    </div>

                    {/* Step banner inline */}
                    {stepLabel[step] && (
                        <div className="flex items-center gap-2 ml-6 bg-accent/10 border border-accent/30 rounded-[var(--radius-md)] px-3 py-1.5">
                            <span className="material-symbols-outlined text-accent text-sm">my_location</span>
                            <span className="text-sm text-accent font-medium">{stepLabel[step]}</span>
                            <button onClick={() => { setStep('idle'); setPendingCamera(null); }}
                                className="ml-2 text-xs text-text-tertiary hover:text-text-primary">Cancel</button>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => { setStep('pick_camera'); setSaveResult(null); }}
                            disabled={step !== 'idle'}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <span className="material-symbols-outlined text-sm">add_location</span>
                            Add Point
                        </button>
                        <button onClick={clearAll} disabled={pairs.length === 0 || step !== 'idle'}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-border-default text-sm text-text-secondary hover:border-danger hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <span className="material-symbols-outlined text-sm">delete_sweep</span>
                            Clear
                        </button>

                        <div className="w-px h-5 bg-border-subtle mx-1" />

                        <span className={`text-xs font-mono px-2 py-1 rounded-full border ${pairs.length >= 4 ? 'border-success/40 text-success bg-success/10' : 'border-warning/40 text-warning bg-warning/10'}`}>
                            {pairs.length} / 4+ pts
                        </span>

                        <button onClick={handleSave} disabled={pairs.length < 4 || saving || step !== 'idle'}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius-md)] bg-success text-white text-sm font-medium hover:bg-success/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <span className={`material-symbols-outlined text-sm ${saving ? 'animate-spin' : ''}`}>
                                {saving ? 'progress_activity' : 'save'}
                            </span>
                            {saving ? 'Saving…' : 'Apply'}
                        </button>

                        <div className="w-px h-5 bg-border-subtle mx-1" />

                        <button onClick={onClose}
                            className="size-8 rounded-[var(--radius-md)] border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary transition-all flex items-center justify-center">
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                </div>

                {/* ── Save result ── */}
                {saveResult && (
                    <div className={`shrink-0 flex items-center gap-2 px-6 py-2.5 text-sm border-b ${saveResult === 'success' ? 'bg-success/10 border-success/20 text-success' : 'bg-danger/10 border-danger/20 text-danger'}`}>
                        <span className="material-symbols-outlined text-base">
                            {saveResult === 'success' ? 'check_circle' : 'error'}
                        </span>
                        {saveResult === 'success'
                            ? 'Calibration saved. Backend will update the homography matrix.'
                            : 'Failed to save. Check backend connection and try again.'}
                    </div>
                )}

                {/* ── Main content ── */}
                <div className="flex flex-1 min-h-0 gap-0">
                    {/* Canvas area */}
                    <div className="flex-1 p-5 flex flex-col min-h-0">
                        <CalibrationCanvas
                            pairs={pairs} step={step} pendingCamera={pendingCamera}
                            onCameraClick={handleCameraClick} onFloorClick={handleFloorClick}
                            currentFrame={currentFrame} wsStatus={wsStatus}
                        />
                    </div>

                    {/* ── Point pairs sidebar ── */}
                    {pairs.length > 0 && (
                        <div className="w-72 shrink-0 border-l border-border-default flex flex-col">
                            <div className="px-4 py-3 border-b border-border-subtle shrink-0">
                                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Point Pairs</p>
                                <p className="text-[10px] text-text-tertiary mt-0.5">Camera → Floor Plan (normalized)</p>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-border-subtle">
                                {pairs.map((p, i) => (
                                    <div key={p.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition-colors group">
                                        <div className="size-5 rounded-full border-2 border-surface-1 flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5"
                                            style={{ backgroundColor: color(i) }}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[13px] text-text-tertiary">videocam</span>
                                                <span className="text-[11px] font-mono text-text-primary">({fmt(p.camera.x)}, {fmt(p.camera.y)})</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[13px] text-text-tertiary">map</span>
                                                <span className="text-[11px] font-mono text-text-primary">({fmt(p.floorPlan.x)}, {fmt(p.floorPlan.y)})</span>
                                            </div>
                                        </div>
                                        <button onClick={() => removePair(p.id)}
                                            className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-all shrink-0 mt-0.5">
                                            <span className="material-symbols-outlined text-base">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main export: Settings card ────────────────────────────────────────────────
export default function MappingCalibration() {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <>
            <div className="bg-surface-1 border border-border-default rounded-[var(--radius-xl)] p-5 flex items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                    <div className="size-10 rounded-[var(--radius-md)] bg-accent/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-accent">pin_drop</span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-text-primary">Homography Calibration</p>
                        <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed max-w-md">
                            Map camera pixel coordinates to floor plan coordinates by selecting
                            corresponding point pairs. Requires ≥ 4 pairs for accurate homography.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setModalOpen(true)}
                    className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all"
                >
                    <span className="material-symbols-outlined text-base">open_in_full</span>
                    Open Calibration
                </button>
            </div>

            {modalOpen && <CalibrationModal onClose={() => setModalOpen(false)} />}
        </>
    );
}
