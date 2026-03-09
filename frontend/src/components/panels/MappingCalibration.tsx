'use client';

import {
    useState, useRef, useCallback, useEffect,
    forwardRef, useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';
import { useTrackingStore } from '@/stores/trackingStore';

const API_BASE =
    'https://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net';

// ── Types ─────────────────────────────────────────────────────────────────────
type ToolType = 'point' | 'line' | 'circle';
interface NormPt { x: number; y: number; }
interface Shape {
    id: number;
    type: ToolType;
    camera: NormPt[];    // 1 pt (point) | 2 pts (line: start/end | circle: center/edge)
    floorPlan: NormPt[];
}
interface PickState {
    tool: ToolType;
    side: 'camera' | 'floor';
    pointIdx: number;
}
interface Pending { camera: NormPt[]; floorPlan: NormPt[]; }
interface ViewState { scale: number; tx: number; ty: number; }

const PTS_NEEDED: Record<ToolType, number> = { point: 1, line: 2, circle: 2 };
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
const gc = (i: number) => COLORS[i % COLORS.length];

// ── ZoomableCanvas ────────────────────────────────────────────────────────────
export interface ZoomHandle { zoomIn(): void; zoomOut(): void; reset(): void; }

interface ZoomProps {
    label: string;
    labelExtra?: React.ReactNode;
    isPicking: boolean;
    onNormClick(x: number, y: number): void;
    children: React.ReactNode;
}

const ZoomableCanvas = forwardRef<ZoomHandle, ZoomProps>(function ZoomableCanvas(
    { label, labelExtra, isPicking, onNormClick, children }, ref,
) {
    const [view, setView] = useState<ViewState>({ scale: 1, tx: 0, ty: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const drag = useRef({ on: false, moved: false, sx: 0, sy: 0, stx: 0, sty: 0 });
    const [isDragging, setIsDragging] = useState(false);

    useImperativeHandle(ref, () => ({
        zoomIn:  () => setView(v => zoom(v, 1.25, null, containerRef.current)),
        zoomOut: () => setView(v => zoom(v, 0.8,  null, containerRef.current)),
        reset:   () => setView({ scale: 1, tx: 0, ty: 0 }),
    }));

    function zoom(v: ViewState, factor: number, cursor: {x:number;y:number}|null, el: HTMLElement|null): ViewState {
        const rect = el?.getBoundingClientRect();
        const cx = cursor ? cursor.x - (rect?.left ?? 0) : (rect?.width ?? 0) / 2;
        const cy = cursor ? cursor.y - (rect?.top  ?? 0) : (rect?.height ?? 0) / 2;
        const ns = Math.max(0.25, Math.min(10, v.scale * factor));
        return { scale: ns, tx: cx - ((cx - v.tx) / v.scale) * ns, ty: cy - ((cy - v.ty) / v.scale) * ns };
    }

    // Passive wheel zoom at cursor
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            e.preventDefault();
            setView(v => zoom(v, e.deltaY < 0 ? 1.1 : 0.9, { x: e.clientX, y: e.clientY }, el));
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    const onMD = useCallback((e: React.MouseEvent) => {
        drag.current = { on: true, moved: false, sx: e.clientX, sy: e.clientY, stx: view.tx, sty: view.ty };
        setIsDragging(true);
    }, [view.tx, view.ty]);

    const onMM = useCallback((e: React.MouseEvent) => {
        const d = drag.current;
        if (!d.on) return;
        const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            d.moved = true;
            setView(v => ({ ...v, tx: d.stx + dx, ty: d.sty + dy }));
        }
    }, []);

    const onMU = useCallback((e: React.MouseEvent) => {
        const d = drag.current;
        d.on = false;
        setIsDragging(false);
        if (!d.moved && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const nx = (e.clientX - rect.left - view.tx) / (rect.width  * view.scale);
            const ny = (e.clientY - rect.top  - view.ty) / (rect.height * view.scale);
            if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) onNormClick(nx, ny);
        }
    }, [view, onNormClick]);

    return (
        <div className="flex flex-col gap-1.5 min-h-0 flex-1">
            {/* Label row + zoom controls */}
            <div className="flex items-center justify-between shrink-0">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider flex items-center gap-2">
                    {label}{labelExtra}
                </span>
                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-text-tertiary font-mono tabular-nums w-10 text-right">
                        {Math.round(view.scale * 100)}%
                    </span>
                    <button onClick={() => setView(v => zoom(v, 0.8, null, containerRef.current))}
                        className="size-6 rounded border border-border-default text-text-secondary hover:bg-surface-3 flex items-center justify-center transition-colors"
                        title="Zoom out (scroll down)">
                        <span className="material-symbols-outlined text-[16px]">remove</span>
                    </button>
                    <button onClick={() => setView(v => zoom(v, 1.25, null, containerRef.current))}
                        className="size-6 rounded border border-border-default text-text-secondary hover:bg-surface-3 flex items-center justify-center transition-colors"
                        title="Zoom in (scroll up)">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                    <button onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}
                        className="size-6 rounded border border-border-default text-text-tertiary hover:bg-surface-3 flex items-center justify-center transition-colors"
                        title="Reset view">
                        <span className="material-symbols-outlined text-[16px]">fit_screen</span>
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div ref={containerRef}
                className={`relative rounded-[var(--radius-lg)] overflow-hidden border-2 flex-1 min-h-0 select-none transition-colors
                    ${isPicking ? 'border-accent ring-4 ring-accent/20' : 'border-border-default'}`}
                style={{ cursor: isPicking ? 'crosshair' : isDragging ? 'grabbing' : 'grab' }}
                onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU}
                onMouseLeave={() => { drag.current.on = false; setIsDragging(false); }}
            >
                {/* Zoom/pan content */}
                <div className="absolute inset-0"
                    style={{ transform: `translate(${view.tx}px,${view.ty}px) scale(${view.scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
                    {children}
                </div>
                {/* Picking hint overlay (on top, unaffected by zoom) */}
                {isPicking && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <span className="material-symbols-outlined text-accent/25 text-9xl">add_circle</span>
                    </div>
                )}
            </div>
        </div>
    );
});

// ── Shape SVG + dot overlay (lives INSIDE zoom context) ──────────────────────
function ShapeLayer({
    shapes, pending, side, shapeOffset,
}: {
    shapes: Shape[];
    pending: Pending | null;
    side: 'camera' | 'floorPlan';
    shapeOffset: number;
}) {
    const pts = (s: Shape | null, isPending: boolean): NormPt[] => {
        if (!s && isPending && pending) return side === 'camera' ? pending.camera : pending.floorPlan;
        if (!s) return [];
        return side === 'camera' ? s.camera : s.floorPlan;
    };

    const allShapes: Array<{ s: Shape | null; idx: number; isPending: boolean; type: ToolType }> = [
        ...shapes.map((s, i) => ({ s, idx: i, isPending: false, type: s.type })),
        ...(pending ? [{ s: null, idx: shapeOffset, isPending: true, type: (pending as any).tool ?? 'point' as ToolType }] : []),
    ];

    return (
        // absolute inset-0 so it fills the content div (before zoom/pan transform)
        <div className="absolute inset-0 pointer-events-none">
            <svg className="absolute inset-0 w-full h-full overflow-visible">
                {allShapes.map(({ s, idx, isPending, type }) => {
                    const points = s ? pts(s, false) : (pending ? (side === 'camera' ? pending.camera : pending.floorPlan) : []);
                    const c = gc(idx);
                    if (points.length < 2) return null;
                    if (type === 'line') return (
                        <line key={`l${idx}`}
                            x1={`${points[0].x * 100}%`} y1={`${points[0].y * 100}%`}
                            x2={`${points[1].x * 100}%`} y2={`${points[1].y * 100}%`}
                            stroke={c} strokeWidth="2" strokeDasharray={isPending ? '6 3' : 'none'} opacity="0.85" />
                    );
                    if (type === 'circle') {
                        // radius in % of average dimension — approximate for SVG
                        const dx = (points[1].x - points[0].x) * 100;
                        const dy = (points[1].y - points[0].y) * 100;
                        const r = Math.sqrt(dx * dx + dy * dy);
                        return (
                            <g key={`c${idx}`}>
                                <circle cx={`${points[0].x * 100}%`} cy={`${points[0].y * 100}%`}
                                    r={`${r}%`} fill="none" stroke={c} strokeWidth="2"
                                    strokeDasharray={isPending ? '6 3' : 'none'} opacity="0.75" />
                                <line
                                    x1={`${points[0].x * 100}%`} y1={`${points[0].y * 100}%`}
                                    x2={`${points[1].x * 100}%`} y2={`${points[1].y * 100}%`}
                                    stroke={c} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
                            </g>
                        );
                    }
                    return null;
                })}
            </svg>

            {/* Dot labels */}
            {allShapes.map(({ s, idx, isPending, type }) => {
                const points = s ? pts(s, false) : (pending ? (side === 'camera' ? pending.camera : pending.floorPlan) : []);
                const c = gc(idx);
                return points.map((p, pi) => (
                    <div key={`d${idx}-${pi}`}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 ${isPending ? 'animate-pulse' : ''}`}
                        style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
                        <div className="size-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                            style={{ backgroundColor: c }}>
                            {type === 'point' ? idx + 1 : `${idx + 1}${['a','b'][pi] ?? pi}`}
                        </div>
                    </div>
                ));
            })}
        </div>
    );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
    shapes, pending, onRemove, onEditPx,
    cameraRef, floorRef,
}: {
    shapes: Shape[];
    pending: Pending | null;
    onRemove(id: number): void;
    onEditPx(id: number, side: 'camera' | 'floorPlan', pi: number, axis: 'x'|'y', px: number): void;
    cameraRef: React.RefObject<HTMLImageElement | null>;
    floorRef:  React.RefObject<HTMLImageElement | null>;
}) {
    const camW = cameraRef.current?.naturalWidth  || 1280;
    const camH = cameraRef.current?.naturalHeight || 720;
    const fpW  = floorRef.current?.naturalWidth   || 1000;
    const fpH  = floorRef.current?.naturalHeight  || 1000;

    const toPx = (n: number, d: number) => Math.round(n * d);

    const ptLabels: Record<ToolType, string[]> = {
        point: ['Pt'],
        line: ['Start', 'End'],
        circle: ['Center', 'Edge'],
    };

    const toolIcon: Record<ToolType, string> = {
        point: 'location_on',
        line: 'timeline',
        circle: 'circle',
    };

    return (
        <div className="w-72 shrink-0 border-l border-border-default flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border-subtle shrink-0">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Shapes</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">Values in pixels — click to edit</p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border-subtle">
                {shapes.length === 0 && !pending && (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
                        <span className="material-symbols-outlined text-3xl text-text-tertiary">add_location</span>
                        <p className="text-xs text-text-tertiary">No shapes yet.<br />Select a tool and click Add.</p>
                    </div>
                )}

                {shapes.map((s, si) => (
                    <div key={s.id} className="px-3 py-3 group hover:bg-surface-2 transition-colors">
                        {/* Shape header */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className="size-5 rounded-full border-2 border-surface-1 flex items-center justify-center text-[9px] font-bold text-white"
                                style={{ backgroundColor: gc(si) }}>
                                {si + 1}
                            </div>
                            <span className="material-symbols-outlined text-[14px]" style={{ color: gc(si) }}>
                                {toolIcon[s.type]}
                            </span>
                            <span className="text-[11px] font-medium text-text-primary capitalize">{s.type}</span>
                            <button onClick={() => onRemove(s.id)}
                                className="ml-auto opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-all">
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        {/* Point rows */}
                        {s.camera.map((cp, pi) => (
                            <div key={pi} className="mb-1.5">
                                <p className="text-[9px] text-text-tertiary uppercase tracking-wider mb-0.5 font-medium">
                                    {ptLabels[s.type][pi] ?? `Pt${pi+1}`}
                                </p>
                                <div className="grid grid-cols-2 gap-1">
                                    {/* Camera */}
                                    <div className="flex items-center gap-0.5 bg-surface-0 rounded px-1.5 py-1 border border-border-subtle">
                                        <span className="material-symbols-outlined text-[11px] text-text-tertiary mr-0.5">videocam</span>
                                        <input type="number"
                                            value={toPx(cp.x, camW)}
                                            onChange={e => onEditPx(s.id, 'camera', pi, 'x', Number(e.target.value))}
                                            className="w-full bg-transparent text-[11px] font-mono text-text-primary outline-none min-w-0" />
                                        <span className="text-[9px] text-text-tertiary">x</span>
                                    </div>
                                    <div className="flex items-center gap-0.5 bg-surface-0 rounded px-1.5 py-1 border border-border-subtle">
                                        <input type="number"
                                            value={toPx(cp.y, camH)}
                                            onChange={e => onEditPx(s.id, 'camera', pi, 'y', Number(e.target.value))}
                                            className="w-full bg-transparent text-[11px] font-mono text-text-primary outline-none min-w-0" />
                                        <span className="text-[9px] text-text-tertiary">y</span>
                                    </div>
                                    {/* Floor plan */}
                                    <div className="flex items-center gap-0.5 bg-surface-0 rounded px-1.5 py-1 border border-border-subtle">
                                        <span className="material-symbols-outlined text-[11px] text-text-tertiary mr-0.5">map</span>
                                        <input type="number"
                                            value={toPx(s.floorPlan[pi]?.x ?? 0, fpW)}
                                            onChange={e => onEditPx(s.id, 'floorPlan', pi, 'x', Number(e.target.value))}
                                            className="w-full bg-transparent text-[11px] font-mono text-text-primary outline-none min-w-0" />
                                        <span className="text-[9px] text-text-tertiary">x</span>
                                    </div>
                                    <div className="flex items-center gap-0.5 bg-surface-0 rounded px-1.5 py-1 border border-border-subtle">
                                        <input type="number"
                                            value={toPx(s.floorPlan[pi]?.y ?? 0, fpH)}
                                            onChange={e => onEditPx(s.id, 'floorPlan', pi, 'y', Number(e.target.value))}
                                            className="w-full bg-transparent text-[11px] font-mono text-text-primary outline-none min-w-0" />
                                        <span className="text-[9px] text-text-tertiary">y</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                {/* In-progress shape */}
                {pending && (
                    <div className="px-3 py-3 bg-accent/5 border-accent/20 border-l-2">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-accent text-sm animate-pulse">edit_location</span>
                            <span className="text-[11px] text-accent font-medium">In progress…</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── CalibrationModal ──────────────────────────────────────────────────────────
function CalibrationModal({ onClose }: { onClose(): void }) {
    const currentFrame = useTrackingStore(s => s.currentFrame);
    const wsStatus     = useTrackingStore(s => s.wsStatus);

    const [shapes,   setShapes]   = useState<Shape[]>([]);
    const [pick,     setPick]     = useState<PickState | null>(null);
    const [pending,  setPending]  = useState<Pending | null>(null);
    const [tool,     setTool]     = useState<ToolType>('point');
    const [saving,   setSaving]   = useState(false);
    const [result,   setResult]   = useState<'success'|'error'|null>(null);

    const nextId  = useRef(1);
    const camRef  = useRef<HTMLImageElement>(null);
    const fpRef   = useRef<HTMLImageElement>(null);
    const camZoom = useRef<ZoomHandle>(null);
    const fpZoom  = useRef<ZoomHandle>(null);

    // Lock body scroll + ESC close
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { if (pick) cancelPick(); else onClose(); }
            if ((e.key === '+' || e.key === '=') && !e.target) { camZoom.current?.zoomIn();  fpZoom.current?.zoomIn(); }
            if (e.key === '-' && !e.target)                    { camZoom.current?.zoomOut(); fpZoom.current?.zoomOut(); }
        };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    }, [pick, onClose]);

    const cancelPick = () => { setPick(null); setPending(null); };

    const startAdd = () => {
        setPick({ tool, side: 'camera', pointIdx: 0 });
        setPending({ camera: [], floorPlan: [] });
        setResult(null);
    };

    const handlePick = useCallback((clickSide: 'camera' | 'floorPlan', x: number, y: number) => {
        setPick(p => {
            if (!p) return null;
            const wantSide = p.side === 'camera' ? 'camera' : 'floorPlan';
            if (clickSide !== wantSide) return p; // wrong canvas

            const needed = PTS_NEEDED[p.tool];

            setPending(prev => {
                if (!prev) return null;
                const updated: Pending = { ...prev };
                if (clickSide === 'camera') {
                    updated.camera = [...prev.camera, { x, y }];
                } else {
                    updated.floorPlan = [...prev.floorPlan, { x, y }];
                }

                // Determine next step
                if (clickSide === 'camera') {
                    if (updated.camera.length < needed) {
                        // need more camera pts
                        setPick({ ...p, pointIdx: p.pointIdx + 1 });
                    } else {
                        // move to floor
                        setPick({ ...p, side: 'floor', pointIdx: 0 });
                    }
                } else {
                    if (updated.floorPlan.length < needed) {
                        setPick({ ...p, pointIdx: p.pointIdx + 1 });
                    } else {
                        // done — commit shape
                        setShapes(prev => [...prev, {
                            id: nextId.current++,
                            type: p.tool,
                            camera: updated.camera,
                            floorPlan: updated.floorPlan,
                        }]);
                        setPick(null);
                        return null;
                    }
                }
                return updated;
            });
            return p; // interim return (will be overwritten by setPick inside)
        });
    }, []);

    const onCamClick = useCallback((x: number, y: number) => {
        if (pick?.side === 'camera') handlePick('camera', x, y);
    }, [pick, handlePick]);

    const onFpClick = useCallback((x: number, y: number) => {
        if (pick?.side === 'floor') handlePick('floorPlan', x, y);
    }, [pick, handlePick]);

    const removeShape = (id: number) => { setShapes(s => s.filter(x => x.id !== id)); setResult(null); };

    const editPx = useCallback((id: number, side: 'camera'|'floorPlan', pi: number, axis: 'x'|'y', px: number) => {
        const cW = camRef.current?.naturalWidth  || 1280;
        const cH = camRef.current?.naturalHeight || 720;
        const fW = fpRef.current?.naturalWidth   || 1000;
        const fH = fpRef.current?.naturalHeight  || 1000;
        const [rW, rH] = side === 'camera' ? [cW, cH] : [fW, fH];
        setShapes(prev => prev.map(s => {
            if (s.id !== id) return s;
            const pts = [...s[side]];
            if (!pts[pi]) return s;
            pts[pi] = { ...pts[pi], [axis]: px / (axis === 'x' ? rW : rH) };
            return { ...s, [side]: pts };
        }));
    }, []);

    const handleSave = async () => {
        if (shapes.length === 0) return;
        const cW = camRef.current?.naturalWidth  || 1280;
        const cH = camRef.current?.naturalHeight || 720;
        const fW = fpRef.current?.naturalWidth   || 1000;
        const fH = fpRef.current?.naturalHeight  || 1000;
        setSaving(true); setResult(null);
        try {
            const res = await fetch(`${API_BASE}/api/lab_management/settings/mapping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shapes: shapes.map(s => ({
                        type: s.type,
                        camera:     s.camera.map(p => [Math.round(p.x * cW), Math.round(p.y * cH)]),
                        floor_plan: s.floorPlan.map(p => [Math.round(p.x * fW), Math.round(p.y * fH)]),
                    })),
                }),
            });
            setResult(res.ok ? 'success' : 'error');
        } catch { setResult('error'); }
        finally { setSaving(false); }
    };

    const stepLabel = (() => {
        if (!pick) return null;
        const { tool: t, side, pointIdx: pi } = pick;
        const on = side === 'camera' ? 'camera frame' : 'floor plan';
        if (t === 'point') return `Click a point on the ${on}`;
        if (t === 'line')  return `Click ${pi === 0 ? 'start' : 'end'} point on the ${on}`;
        if (t === 'circle') return `Click ${pi === 0 ? 'center' : 'edge (radius)'} on the ${on}`;
    })();

    const toolDef: { type: ToolType; icon: string; label: string }[] = [
        { type: 'point',  icon: 'location_on', label: 'Point'  },
        { type: 'line',   icon: 'timeline',    label: 'Line'   },
        { type: 'circle', icon: 'circle',      label: 'Circle' },
    ];

    const modal = (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            style={{ zIndex: 9999 }}
            onClick={onClose}>
            <div className="bg-surface-1 border border-border-strong rounded-[var(--radius-xl)] shadow-2xl flex flex-col"
                style={{ width: 'calc(100vw - 3rem)', height: 'calc(100vh - 3rem)', zIndex: 10000 }}
                onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-border-default flex-wrap">
                    <span className="material-symbols-outlined text-accent">map</span>
                    <div className="mr-2">
                        <h2 className="text-sm font-bold text-text-primary">2D Mapping Calibration</h2>
                        <p className="text-[10px] text-text-tertiary">Place shapes on both views to define coordinate mapping</p>
                    </div>

                    {/* Tool selector */}
                    <div className="flex items-center gap-1 bg-surface-0 rounded-[var(--radius-md)] p-1 border border-border-subtle">
                        {toolDef.map(td => (
                            <button key={td.type}
                                onClick={() => { setTool(td.type); cancelPick(); }}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-all ${tool === td.type ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'}`}>
                                <span className="material-symbols-outlined text-sm">{td.icon}</span>
                                {td.label}
                            </button>
                        ))}
                    </div>

                    {/* Step hint */}
                    {stepLabel && (
                        <div className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-[var(--radius-md)] px-3 py-1.5">
                            <span className="material-symbols-outlined text-accent text-sm">my_location</span>
                            <span className="text-xs text-accent font-medium">{stepLabel}</span>
                            <button onClick={cancelPick}
                                className="ml-1 text-[10px] text-accent/70 hover:text-accent underline underline-offset-2">
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Right actions */}
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={startAdd} disabled={!!pick}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <span className="material-symbols-outlined text-sm">add_location</span>
                            Add {tool}
                        </button>
                        <button onClick={() => { setShapes([]); cancelPick(); setResult(null); }}
                            disabled={shapes.length === 0 && !pick}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-border-default text-xs text-text-secondary hover:border-danger hover:text-danger disabled:opacity-40 transition-all">
                            <span className="material-symbols-outlined text-sm">delete_sweep</span>
                            Clear all
                        </button>
                        <div className="w-px h-5 bg-border-subtle" />
                        <span className={`text-xs font-mono px-2 py-1 rounded-full border ${shapes.length >= 4 ? 'border-success/40 text-success bg-success/10' : 'border-warning/40 text-warning bg-warning/10'}`}>
                            {shapes.length} shape{shapes.length !== 1 ? 's' : ''}
                        </span>
                        <button onClick={handleSave} disabled={shapes.length === 0 || saving || !!pick}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius-md)] bg-success text-white text-xs font-medium hover:bg-success/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <span className={`material-symbols-outlined text-sm ${saving ? 'animate-spin' : ''}`}>
                                {saving ? 'progress_activity' : 'save'}
                            </span>
                            {saving ? 'Saving…' : 'Apply'}
                        </button>
                        <div className="w-px h-5 bg-border-subtle" />
                        <button onClick={onClose}
                            className="size-8 rounded-[var(--radius-md)] border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary flex items-center justify-center transition-all">
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                </div>

                {/* Save result */}
                {result && (
                    <div className={`shrink-0 flex items-center gap-2 px-5 py-2 text-xs border-b ${result === 'success' ? 'bg-success/10 border-success/20 text-success' : 'bg-danger/10 border-danger/20 text-danger'}`}>
                        <span className="material-symbols-outlined text-sm">{result === 'success' ? 'check_circle' : 'error'}</span>
                        {result === 'success' ? 'Calibration saved. Backend will recompute the mapping.' : 'Failed to save. Check backend connection.'}
                    </div>
                )}

                {/* ── Body ── */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    {/* Canvases */}
                    <div className="flex-1 min-w-0 p-4 flex flex-col gap-4 min-h-0">
                        {/* Tip */}
                        <p className="shrink-0 text-[11px] text-text-tertiary">
                            <span className="text-accent font-medium">Scroll</span> to zoom ·
                            <span className="text-accent font-medium ml-1">Drag</span> to pan ·
                            <span className="text-accent font-medium ml-1">+/−</span> buttons or keyboard
                        </p>

                        <div className="flex gap-4 flex-1 min-h-0">
                            {/* Camera */}
                            <ZoomableCanvas ref={camZoom} label="Camera Frame"
                                labelExtra={wsStatus !== 'connected' && <span className="text-warning normal-case font-normal">(no stream)</span>}
                                isPicking={pick?.side === 'camera'}
                                onNormClick={onCamClick}>
                                {currentFrame
                                    ? <img ref={camRef} src={currentFrame} alt="camera" draggable={false}
                                        className="absolute inset-0 w-full h-full object-contain bg-black" />
                                    : <div className="absolute inset-0 bg-surface-0 flex flex-col items-center justify-center gap-2">
                                        <span className="material-symbols-outlined text-5xl text-text-tertiary">videocam_off</span>
                                        <p className="text-xs text-text-tertiary">No live frame</p>
                                      </div>
                                }
                                <ShapeLayer shapes={shapes} pending={pending} side="camera" shapeOffset={shapes.length} />
                            </ZoomableCanvas>

                            {/* Floor plan */}
                            <ZoomableCanvas ref={fpZoom} label="Floor Plan"
                                isPicking={pick?.side === 'floor'}
                                onNormClick={onFpClick}>
                                <img ref={fpRef} src="/labmap.svg" alt="floor plan" draggable={false}
                                    className="absolute inset-0 w-full h-full object-contain bg-surface-0" />
                                <ShapeLayer shapes={shapes} pending={pending} side="floorPlan" shapeOffset={shapes.length} />
                            </ZoomableCanvas>
                        </div>
                    </div>

                    {/* Sidebar — always visible */}
                    <Sidebar
                        shapes={shapes} pending={pending}
                        onRemove={removeShape} onEditPx={editPx}
                        cameraRef={camRef} floorRef={fpRef}
                    />
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}

// ── Settings card (entry point) ───────────────────────────────────────────────
export default function MappingCalibration() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <div className="bg-surface-1 border border-border-default rounded-[var(--radius-xl)] p-5 flex items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                    <div className="size-10 rounded-[var(--radius-md)] bg-accent/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-accent">pin_drop</span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-text-primary">Homography Calibration</p>
                        <p className="text-xs text-text-tertiary mt-1 leading-relaxed max-w-md">
                            Place points, lines, and circles on the camera view and floor plan to
                            define the coordinate mapping used by the backend. Requires ≥ 4 point pairs.
                        </p>
                    </div>
                </div>
                <button onClick={() => setOpen(true)}
                    className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] bg-accent text-white text-sm font-medium hover:bg-accent/90 active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-base">open_in_full</span>
                    Open Calibration
                </button>
            </div>
            {open && <CalibrationModal onClose={() => setOpen(false)} />}
        </>
    );
}
