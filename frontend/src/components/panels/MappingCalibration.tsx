'use client';

import { useState, useRef, useCallback } from 'react';
import { useTrackingStore } from '@/stores/trackingStore';

const API_BASE =
    'https://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net';

// Normalized point [0..1, 0..1]
interface NormPoint {
    x: number;
    y: number;
}

interface PointPair {
    id: number;
    camera: NormPoint;   // normalized coords on camera frame
    floorPlan: NormPoint; // normalized coords on floor plan
}

type Step = 'idle' | 'pick_camera' | 'pick_floor';

const DOT_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

export default function MappingCalibration() {
    const currentFrame = useTrackingStore((s) => s.currentFrame);
    const wsStatus = useTrackingStore((s) => s.wsStatus);

    const [pairs, setPairs] = useState<PointPair[]>([]);
    const [step, setStep] = useState<Step>('idle');
    const [pendingCamera, setPendingCamera] = useState<NormPoint | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
    const nextId = useRef(1);

    // ── Click handlers ────────────────────────────────────────────────────

    const handleCameraClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (step !== 'pick_camera') return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            setPendingCamera({ x, y });
            setStep('pick_floor');
        },
        [step],
    );

    const handleFloorClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (step !== 'pick_floor' || !pendingCamera) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            setPairs((prev) => [
                ...prev,
                { id: nextId.current++, camera: pendingCamera, floorPlan: { x, y } },
            ]);
            setPendingCamera(null);
            setStep('idle');
            setSaveResult(null);
        },
        [step, pendingCamera],
    );

    const removePair = (id: number) => {
        setPairs((prev) => prev.filter((p) => p.id !== id));
        setSaveResult(null);
    };

    const clearAll = () => {
        setPairs([]);
        setPendingCamera(null);
        setStep('idle');
        setSaveResult(null);
    };

    // ── Save to backend ───────────────────────────────────────────────────

    const handleSave = async () => {
        if (pairs.length < 4) return;
        setSaving(true);
        setSaveResult(null);
        try {
            const body = {
                point_pairs: pairs.map((p) => ({
                    src: [p.camera.x, p.camera.y],       // camera normalized
                    dst: [p.floorPlan.x, p.floorPlan.y], // floor plan normalized
                })),
            };
            const res = await fetch(`${API_BASE}/api/lab_management/settings/mapping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            setSaveResult(res.ok ? 'success' : 'error');
        } catch {
            setSaveResult('error');
        } finally {
            setSaving(false);
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────

    const fmt = (n: number) => (n * 100).toFixed(1) + '%';
    const color = (i: number) => DOT_COLORS[i % DOT_COLORS.length];

    const stepLabel = {
        idle: null,
        pick_camera: '① Click a point on the camera frame',
        pick_floor: '② Click the corresponding point on the floor plan',
    }[step];

    return (
        <div className="space-y-5">
            {/* ── Instruction banner ── */}
            <div className="bg-surface-1 border border-border-default rounded-[var(--radius-lg)] p-4 text-xs text-text-tertiary leading-relaxed">
                <p className="font-medium text-text-secondary mb-1">How it works</p>
                Select at least <span className="text-accent font-bold">4 point pairs</span> — click a
                recognizable point on the camera view, then click the matching location on the floor
                plan. The backend uses these pairs to compute the homography for 2D coordinate
                mapping.
            </div>

            {/* ── Step banner ── */}
            {stepLabel && (
                <div className="flex items-center gap-3 bg-accent/10 border border-accent/30 rounded-[var(--radius-lg)] px-4 py-3 animate-fade-in">
                    <span className="material-symbols-outlined text-accent text-lg">
                        my_location
                    </span>
                    <span className="text-sm text-accent font-medium">{stepLabel}</span>
                    <button
                        onClick={() => { setStep('idle'); setPendingCamera(null); }}
                        className="ml-auto text-xs text-text-tertiary hover:text-text-primary transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* ── Dual canvas ── */}
            <div className="grid grid-cols-2 gap-4">
                {/* Camera frame */}
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Camera Frame
                        {wsStatus !== 'connected' && (
                            <span className="ml-2 text-warning normal-case font-normal">
                                (not connected)
                            </span>
                        )}
                    </p>
                    <div
                        className={`relative rounded-[var(--radius-lg)] overflow-hidden bg-surface-0 border-2 transition-all select-none
                            ${step === 'pick_camera'
                                ? 'border-accent cursor-crosshair ring-2 ring-accent/30'
                                : 'border-border-default cursor-default'}`}
                        style={{ aspectRatio: '16/9' }}
                        onClick={handleCameraClick}
                    >
                        {currentFrame ? (
                            <img
                                src={currentFrame}
                                alt="Camera"
                                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                                draggable={false}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="material-symbols-outlined text-3xl text-text-tertiary">
                                    videocam_off
                                </span>
                            </div>
                        )}

                        {/* Placed camera points */}
                        {pairs.map((p, i) => (
                            <div
                                key={p.id}
                                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ left: `${p.camera.x * 100}%`, top: `${p.camera.y * 100}%` }}
                            >
                                <div
                                    className="size-5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-lg"
                                    style={{ backgroundColor: color(i) }}
                                >
                                    {i + 1}
                                </div>
                            </div>
                        ))}

                        {/* Pending camera point preview */}
                        {step === 'pick_floor' && pendingCamera && (
                            <div
                                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse"
                                style={{ left: `${pendingCamera.x * 100}%`, top: `${pendingCamera.y * 100}%` }}
                            >
                                <div
                                    className="size-5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-lg"
                                    style={{ backgroundColor: color(pairs.length) }}
                                >
                                    {pairs.length + 1}
                                </div>
                            </div>
                        )}

                        {/* Overlay hint when picking */}
                        {step === 'pick_camera' && (
                            <div className="absolute inset-0 bg-accent/5 flex items-center justify-center pointer-events-none">
                                <span className="material-symbols-outlined text-accent/50 text-5xl">
                                    add_circle
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Floor plan */}
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Floor Plan
                    </p>
                    <div
                        className={`relative rounded-[var(--radius-lg)] overflow-hidden bg-surface-0 border-2 transition-all select-none
                            ${step === 'pick_floor'
                                ? 'border-accent cursor-crosshair ring-2 ring-accent/30'
                                : 'border-border-default cursor-default'}`}
                        style={{ aspectRatio: '16/9' }}
                        onClick={handleFloorClick}
                    >
                        <img
                            src="/labmap.svg"
                            alt="Floor Plan"
                            className="absolute inset-0 w-full h-full object-contain bg-surface-1 pointer-events-none"
                            draggable={false}
                        />

                        {/* Placed floor plan points */}
                        {pairs.map((p, i) => (
                            <div
                                key={p.id}
                                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ left: `${p.floorPlan.x * 100}%`, top: `${p.floorPlan.y * 100}%` }}
                            >
                                <div
                                    className="size-5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-lg"
                                    style={{ backgroundColor: color(i) }}
                                >
                                    {i + 1}
                                </div>
                            </div>
                        ))}

                        {/* Overlay hint when picking */}
                        {step === 'pick_floor' && (
                            <div className="absolute inset-0 bg-accent/5 flex items-center justify-center pointer-events-none">
                                <span className="material-symbols-outlined text-accent/50 text-5xl">
                                    add_circle
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Action row ── */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => { setStep('pick_camera'); setSaveResult(null); }}
                    disabled={step !== 'idle'}
                    className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <span className="material-symbols-outlined text-base">add_location</span>
                    Add Point Pair
                </button>

                <button
                    onClick={clearAll}
                    disabled={pairs.length === 0 || step !== 'idle'}
                    className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] border border-border-default text-sm text-text-secondary hover:border-danger hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <span className="material-symbols-outlined text-base">delete_sweep</span>
                    Clear All
                </button>

                <div className="ml-auto flex items-center gap-3">
                    {/* Point count badge */}
                    <span className={`text-xs font-mono px-2 py-1 rounded-full border ${
                        pairs.length >= 4
                            ? 'border-success/40 text-success bg-success/10'
                            : 'border-warning/40 text-warning bg-warning/10'
                    }`}>
                        {pairs.length} / 4+ points
                    </span>

                    <button
                        onClick={handleSave}
                        disabled={pairs.length < 4 || saving || step !== 'idle'}
                        className="flex items-center gap-2 px-5 py-2 rounded-[var(--radius-md)] bg-success text-white text-sm font-medium hover:bg-success/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`}>
                            {saving ? 'progress_activity' : 'save'}
                        </span>
                        {saving ? 'Saving…' : 'Apply to Backend'}
                    </button>
                </div>
            </div>

            {/* ── Save result ── */}
            {saveResult && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-[var(--radius-lg)] border text-sm animate-fade-in ${
                    saveResult === 'success'
                        ? 'bg-success/10 border-success/30 text-success'
                        : 'bg-danger/10 border-danger/30 text-danger'
                }`}>
                    <span className="material-symbols-outlined text-base">
                        {saveResult === 'success' ? 'check_circle' : 'error'}
                    </span>
                    {saveResult === 'success'
                        ? 'Mapping calibration saved. Backend will update the transform matrix.'
                        : 'Failed to save. Check the backend connection and try again.'}
                </div>
            )}

            {/* ── Point pairs table ── */}
            {pairs.length > 0 && (
                <div className="bg-surface-1 border border-border-default rounded-[var(--radius-lg)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                            Point Pairs
                        </span>
                        <span className="text-xs text-text-tertiary">
                            Camera (x, y) → Floor Plan (x, y) — normalized 0..1
                        </span>
                    </div>
                    <div className="divide-y divide-border-subtle">
                        {pairs.map((p, i) => (
                            <div key={p.id} className="flex items-center gap-4 px-4 py-2.5 hover:bg-surface-2 transition-colors group">
                                {/* Color dot + index */}
                                <div
                                    className="size-5 rounded-full border-2 border-surface-1 flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                    style={{ backgroundColor: color(i) }}
                                >
                                    {i + 1}
                                </div>
                                {/* Camera coords */}
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="material-symbols-outlined text-sm text-text-tertiary">
                                        videocam
                                    </span>
                                    <span className="text-xs font-mono text-text-primary">
                                        ({fmt(p.camera.x)}, {fmt(p.camera.y)})
                                    </span>
                                </div>
                                <span className="material-symbols-outlined text-sm text-text-tertiary">
                                    arrow_forward
                                </span>
                                {/* Floor plan coords */}
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="material-symbols-outlined text-sm text-text-tertiary">
                                        map
                                    </span>
                                    <span className="text-xs font-mono text-text-primary">
                                        ({fmt(p.floorPlan.x)}, {fmt(p.floorPlan.y)})
                                    </span>
                                </div>
                                {/* Delete */}
                                <button
                                    onClick={() => removePair(p.id)}
                                    className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-all"
                                    aria-label="Remove pair"
                                >
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
