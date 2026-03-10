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
type ToolType = 'point' | 'line';
interface NormPt { x: number; y: number; }
interface Shape {
    id: number;
    type: ToolType;
    camera: NormPt[];    // point:1pt | line:2pts(start,end)
    floorPlan: NormPt[];
}

// line uses drag; point uses click
const DRAG_TOOLS: ToolType[] = ['line'];
// PTS_CLICK only matters for point (drag tools set to 0)
const PTS_CLICK: Record<ToolType, number> = { point: 1, line: 0 };

interface PickState {
    tool: ToolType;
    side: 'camera' | 'floor';
    pointIdx: number;
}
interface Pending { camera: NormPt[]; floorPlan: NormPt[]; }
interface ViewState { scale: number; tx: number; ty: number; }

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
const gc = (i: number) => COLORS[i % COLORS.length];

// ── ZoomHandle ────────────────────────────────────────────────────────────────
export interface ZoomHandle { zoomIn(): void; zoomOut(): void; reset(): void; }

// ── Single zoom-invariant dot ─────────────────────────────────────────────────
function ShapeDot({ x, y, size, color, label, isPending = false, isSelected = false, onDoubleClick }: {
    x: number; y: number; size: number; color: string; label?: string; isPending?: boolean;
    isSelected?: boolean; onDoubleClick?: () => void;
}) {
    return (
        <div
            className={`absolute flex items-center justify-center ${isPending ? 'animate-pulse' : ''} ${isSelected ? 'ring-4 ring-white shadow-[0_0_10px_white] z-50' : ''}`}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClick?.();
            }}
            style={{
                left: x, top: y,
                width: size, height: size,
                transform: 'translate(-50%, -50%)',
                backgroundColor: color,
                borderRadius: '50%',
                border: '1.5px solid rgba(255,255,255,0.85)',
                boxShadow: isSelected ? '0 0 12px white' : '0 1px 4px rgba(0,0,0,0.55)',
                opacity: isPending ? 0.75 : 1,
                fontSize: '6px',
                lineHeight: 1,
                color: 'white',
                fontWeight: 'bold',
                userSelect: 'none',
                pointerEvents: isPending ? 'none' : 'auto',
                cursor: 'pointer',
            }}
        >
            {label}
        </div>
    );
}

// ── DotsOverlay — rendered OUTSIDE zoom transform so size stays constant ──────
function DotsOverlay({ shapes, pending, pickTool, side, view, cW, cH, selectedShapeId, onShapeDoubleClick }: {
    shapes: Shape[];
    pending: Pending | null;
    pickTool: ToolType | null;
    side: 'camera' | 'floorPlan';
    view: ViewState;
    cW: number;
    cH: number;
    selectedShapeId: number | null;
    onShapeDoubleClick: (id: number) => void;
}) {
    if (!cW || !cH) return null;

    const toS = (p: NormPt) => ({
        x: view.tx + p.x * cW * view.scale,
        y: view.ty + p.y * cH * view.scale,
    });

    const dotsForShape = (s: Shape, si: number, isPending = false): React.ReactNode[] => {
        const pts = side === 'camera' ? s.camera : s.floorPlan;
        const color = gc(si);
        const isSelected = s.id === selectedShapeId;
        if (pts.length === 0) return [];

        if (s.type === 'point' && pts.length >= 1) {
            const { x, y } = toS(pts[0]);
            return [
                <ShapeDot
                    key={`${s.id}-0`} x={x} y={y} size={10} color={color}
                    isPending={isPending} isSelected={isSelected}
                    onDoubleClick={() => !isPending && onShapeDoubleClick(s.id)}
                />
            ];
        }

        if (s.type === 'line' && pts.length >= 2) {
            const sp = toS(pts[0]);
            const ep = toS(pts[1]);
            return [
                <ShapeDot
                    key={`${s.id}-s`} x={sp.x} y={sp.y} size={9} color={color} label="S"
                    isPending={isPending} isSelected={isSelected}
                    onDoubleClick={() => !isPending && onShapeDoubleClick(s.id)}
                />,
                <ShapeDot
                    key={`${s.id}-e`} x={ep.x} y={ep.y} size={9} color={color} label="E"
                    isPending={isPending} isSelected={isSelected}
                    onDoubleClick={() => !isPending && onShapeDoubleClick(s.id)}
                />,
            ];
        }

        return [];
    };

    const pendPts = pending ? (side === 'camera' ? pending.camera : pending.floorPlan) : [];
    const pendShape: Shape | null = (pending && pickTool && pendPts.length > 0)
        ? { id: -1, type: pickTool, camera: pending.camera, floorPlan: pending.floorPlan }
        : null;

    return (
        <>
            {shapes.map((s, si) => dotsForShape(s, si))}
            {pendShape && dotsForShape(pendShape, shapes.length, true)}
        </>
    );
}

// ── ZoomableCanvas ────────────────────────────────────────────────────────────
const ZoomableCanvas = forwardRef<ZoomHandle, {
    label: string;
    labelExtra?: React.ReactNode;
    isPicking: boolean;
    isDragTool: boolean;
    activeTool?: ToolType | null;
    onNormClick(x: number, y: number): void;
    onNormDragEnd(x1: number, y1: number, x2: number, y2: number): void;
    overlay?: (view: ViewState, cW: number, cH: number) => React.ReactNode;
    children: React.ReactNode;
}>(function ZoomableCanvas({
    label, labelExtra, isPicking, isDragTool, activeTool,
    onNormClick, onNormDragEnd, overlay, children,
}, ref) {
    const [view, setView] = useState<ViewState>({ scale: 1, tx: 0, ty: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [drawPrev, setDrawPrev] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);
    const [cSize, setCSize] = useState({ w: 0, h: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const panRef = useRef({ on: false, moved: false, sx: 0, sy: 0, stx: 0, sty: 0 });
    const drawRef = useRef({ on: false, snx: 0, sny: 0 });

    useImperativeHandle(ref, () => ({
        zoomIn: () => setView(v => applyZoom(v, 1.25, null, containerRef.current)),
        zoomOut: () => setView(v => applyZoom(v, 0.8, null, containerRef.current)),
        reset: () => setView({ scale: 1, tx: 0, ty: 0 }),
    }));

    // Track container size for overlay dot positioning
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            const rect = entries[0].contentRect;
            setCSize({ w: rect.width, h: rect.height });
        });
        ro.observe(el);
        setCSize({ w: el.offsetWidth, h: el.offsetHeight });
        return () => ro.disconnect();
    }, []);

    function applyZoom(v: ViewState, f: number, cur: { x: number; y: number } | null, el: HTMLElement | null): ViewState {
        const r = el?.getBoundingClientRect();
        const cx = cur ? cur.x - (r?.left ?? 0) : (r?.width ?? 0) / 2;
        const cy = cur ? cur.y - (r?.top ?? 0) : (r?.height ?? 0) / 2;
        const ns = Math.max(0.25, Math.min(10, v.scale * f));
        return { scale: ns, tx: cx - ((cx - v.tx) / v.scale) * ns, ty: cy - ((cy - v.ty) / v.scale) * ns };
    }

    function normPos(clientX: number, clientY: number, v: ViewState, r: DOMRect) {
        return {
            x: Math.max(0, Math.min(1, (clientX - r.left - v.tx) / (r.width * v.scale))),
            y: Math.max(0, Math.min(1, (clientY - r.top - v.ty) / (r.height * v.scale))),
        };
    }

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const h = (e: WheelEvent) => {
            e.preventDefault();
            setView(v => applyZoom(v, e.deltaY < 0 ? 1.1 : 0.9, { x: e.clientX, y: e.clientY }, el));
        };
        el.addEventListener('wheel', h, { passive: false });
        return () => el.removeEventListener('wheel', h);
    }, []);

    const onMD = useCallback((e: React.MouseEvent) => {
        const r = containerRef.current?.getBoundingClientRect();
        if (!r) return;
        if (isPicking && isDragTool) {
            const { x, y } = normPos(e.clientX, e.clientY, view, r);
            drawRef.current = { on: true, snx: x, sny: y };
            setDrawPrev({ sx: x, sy: y, ex: x, ey: y });
        } else {
            panRef.current = { on: true, moved: false, sx: e.clientX, sy: e.clientY, stx: view.tx, sty: view.ty };
            setIsDragging(true);
        }
    }, [isPicking, isDragTool, view]);

    const onMM = useCallback((e: React.MouseEvent) => {
        const r = containerRef.current?.getBoundingClientRect();
        if (!r) return;
        if (drawRef.current.on) {
            const { x, y } = normPos(e.clientX, e.clientY, view, r);
            setDrawPrev({ sx: drawRef.current.snx, sy: drawRef.current.sny, ex: x, ey: y });
        } else if (panRef.current.on) {
            const dx = e.clientX - panRef.current.sx;
            const dy = e.clientY - panRef.current.sy;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                panRef.current.moved = true;
                setView(v => ({ ...v, tx: panRef.current.stx + dx, ty: panRef.current.sty + dy }));
            }
        }
    }, [view]);

    const onMU = useCallback((e: React.MouseEvent) => {
        const r = containerRef.current?.getBoundingClientRect();
        if (!r) return;
        if (drawRef.current.on) {
            const { snx, sny } = drawRef.current;
            drawRef.current.on = false;
            setDrawPrev(null);
            const { x, y } = normPos(e.clientX, e.clientY, view, r);
            onNormDragEnd(snx, sny, x, y);
        } else if (panRef.current.on) {
            const moved = panRef.current.moved;
            panRef.current.on = false;
            setIsDragging(false);
            if (!moved && isPicking && !isDragTool) {
                const { x, y } = normPos(e.clientX, e.clientY, view, r);
                onNormClick(x, y);
            }
        }
    }, [view, isPicking, isDragTool, onNormClick, onNormDragEnd]);

    const cursor = isPicking ? 'crosshair' : isDragging ? 'grabbing' : 'grab';

    const hintIcon = isDragTool
        ? (activeTool === 'line' ? 'show_chart' : 'open_with')
        : 'add_circle';

    return (
        <div className="flex flex-col gap-1.5 min-h-0 flex-1">
            <div className="flex items-center justify-between shrink-0">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider flex items-center gap-2">
                    {label}{labelExtra}
                </span>
                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-text-tertiary font-mono w-10 text-right tabular-nums">
                        {Math.round(view.scale * 100)}%
                    </span>
                    {[['remove', 0.8], ['add', 1.25]].map(([icon, f]) => (
                        <button key={icon as string}
                            onClick={() => setView(v => applyZoom(v, f as number, null, containerRef.current))}
                            className="size-6 rounded border border-border-default text-text-secondary hover:bg-surface-3 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-[16px]">{icon}</span>
                        </button>
                    ))}
                    <button onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}
                        className="size-6 rounded border border-border-default text-text-tertiary hover:bg-surface-3 flex items-center justify-center transition-colors" title="Reset">
                        <span className="material-symbols-outlined text-[16px]">fit_screen</span>
                    </button>
                </div>
            </div>

            <div ref={containerRef}
                className={`relative rounded-[var(--radius-lg)] overflow-hidden border-2 flex-1 min-h-0 select-none transition-colors
                    ${isPicking ? 'border-accent ring-4 ring-accent/20' : 'border-border-default'}`}
                style={{ cursor }}
                onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU}
                onMouseLeave={() => {
                    panRef.current.on = false; drawRef.current.on = false;
                    setIsDragging(false); setDrawPrev(null);
                }}
            >
                {/* ── Zoom-transformed content ── */}
                <div className="absolute inset-0"
                    style={{ transform: `translate(${view.tx}px,${view.ty}px) scale(${view.scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
                    {children}

                    {drawPrev && activeTool === 'line' && (
                        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                            <line
                                x1={`${drawPrev.sx * 100}%`} y1={`${drawPrev.sy * 100}%`}
                                x2={`${drawPrev.ex * 100}%`} y2={`${drawPrev.ey * 100}%`}
                                stroke="rgba(59,130,246,0.75)" strokeWidth="2" strokeDasharray="6,3" />
                        </svg>
                    )}
                </div>

                {/* ── Zoom-invariant dots overlay ── */}
                <div className="absolute inset-0 pointer-events-none">
                    {overlay?.(view, cSize.w, cSize.h)}
                </div>

                {/* Picking hint */}
                {isPicking && !drawPrev && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <span className="material-symbols-outlined text-accent/20 text-9xl">{hintIcon}</span>
                    </div>
                )}
            </div>
        </div>
    );
});

// ── ShapeLayer (inside zoom context — outlines only, no dots) ─────────────────
function ShapeLayer({ shapes, pending, pickTool, side }: {
    shapes: Shape[];
    pending: Pending | null;
    pickTool: ToolType | null;
    side: 'camera' | 'floorPlan';
}) {
    const getPts = (s: Shape) => side === 'camera' ? s.camera : s.floorPlan;
    const pendPts = pending ? (side === 'camera' ? pending.camera : pending.floorPlan) : [];

    return (
        <div className="absolute inset-0 pointer-events-none">
            {/* SVG: committed lines + pending line */}
            <svg className="absolute inset-0 w-full h-full overflow-visible">
                {shapes.map((s, i) => {
                    const pts = getPts(s);
                    if (s.type !== 'line' || pts.length < 2) return null;
                    return (
                        <line key={s.id}
                            x1={`${pts[0].x * 100}%`} y1={`${pts[0].y * 100}%`}
                            x2={`${pts[1].x * 100}%`} y2={`${pts[1].y * 100}%`}
                            stroke={gc(i)} strokeWidth="2" opacity="0.85" />
                    );
                })}
                {/* Pending line (camera drag done, floor drag pending) */}
                {pickTool === 'line' && pendPts.length === 2 && (
                    <line
                        x1={`${pendPts[0].x * 100}%`} y1={`${pendPts[0].y * 100}%`}
                        x2={`${pendPts[1].x * 100}%`} y2={`${pendPts[1].y * 100}%`}
                        stroke={gc(shapes.length)} strokeWidth="2" strokeDasharray="6,3" opacity="0.7" />
                )}
            </svg>
        </div>
    );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ shapes, pending, pickTool, onRemove, onEditPx, camRef, fpRef, selectedShapeId, onSelect }: {
    shapes: Shape[];
    pending: Pending | null;
    pickTool: ToolType | null;
    onRemove(id: number): void;
    onEditPx(id: number, side: 'camera' | 'floorPlan', pi: number, axis: 'x' | 'y', px: number): void;
    camRef: React.RefObject<HTMLImageElement | null>;
    fpRef: React.RefObject<HTMLImageElement | null>;
    selectedShapeId: number | null;
    onSelect(id: number): void;
}) {
    const cW = camRef.current?.naturalWidth || 1280;
    const cH = camRef.current?.naturalHeight || 720;
    const fW = fpRef.current?.naturalWidth || 1000;
    const fH = fpRef.current?.naturalHeight || 1000;

    const px = (n: number, d: number) => Math.round(n * d);

    const ptLabels: Record<ToolType, string[]> = {
        point: ['Point'],
        line: ['Start', 'End'],
    };
    const toolIcon: Record<ToolType, string> = {
        point: 'location_on', line: 'timeline',
    };

    return (
        <div className="w-72 shrink-0 border-l border-border-default flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border-subtle shrink-0">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Shapes</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">
                    <span className="text-success">cam</span> = camera px ·&nbsp;
                    <span className="text-accent">fp</span> = floor plan px
                </p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border-subtle">
                {shapes.length === 0 && !pending && (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
                        <span className="material-symbols-outlined text-4xl text-text-tertiary">add_location_alt</span>
                        <p className="text-xs text-text-tertiary leading-relaxed">
                            No shapes yet.<br />Click a tool button above to start.
                        </p>
                    </div>
                )}

                {shapes.map((s, si) => (
                    <div
                        key={s.id}
                        data-shape-id={s.id}
                        onClick={() => onSelect(s.id)}
                        className={`px-3 py-3 group hover:bg-surface-2 transition-colors cursor-pointer ${s.id === selectedShapeId ? 'bg-surface-2 ring-1 ring-accent' : ''
                            }`}
                    >
                        <div className="flex items-center gap-2 mb-2.5">
                            <div className="size-5 rounded-full border-2 border-surface-1 flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                style={{ backgroundColor: gc(si) }}>
                                {si + 1}
                            </div>
                            <span className="material-symbols-outlined text-[14px]" style={{ color: gc(si) }}>
                                {toolIcon[s.type]}
                            </span>
                            <span className="text-[11px] font-semibold text-text-primary capitalize">{s.type}</span>
                            <button onClick={() => onRemove(s.id)}
                                className="ml-auto opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-all">
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        {s.camera.map((cp, pi) => (
                            <div key={pi} className="mb-2">
                                <p className="text-[9px] text-text-tertiary uppercase tracking-wider font-medium mb-1">
                                    {ptLabels[s.type][pi] ?? `Pt ${pi + 1}`}
                                </p>
                                <div className="grid grid-cols-2 gap-1">
                                    <PxInput icon="videocam" label="x" color="text-success"
                                        value={px(cp.x, cW)}
                                        onChange={v => onEditPx(s.id, 'camera', pi, 'x', v)} />
                                    <PxInput icon="" label="y" color="text-success"
                                        value={px(cp.y, cH)}
                                        onChange={v => onEditPx(s.id, 'camera', pi, 'y', v)} />
                                    <PxInput icon="map" label="x" color="text-accent"
                                        value={px((s.floorPlan[pi]?.x ?? 0), fW)}
                                        onChange={v => onEditPx(s.id, 'floorPlan', pi, 'x', v)} />
                                    <PxInput icon="" label="y" color="text-accent"
                                        value={px((s.floorPlan[pi]?.y ?? 0), fH)}
                                        onChange={v => onEditPx(s.id, 'floorPlan', pi, 'y', v)} />
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                {pending && (
                    <div className="px-3 py-3 bg-accent/5 border-l-2 border-accent/40">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-accent text-sm animate-pulse">edit_location</span>
                            <span className="text-[11px] text-accent font-medium capitalize">
                                Adding {pickTool}…
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PxInput({ icon, label, color, value, onChange }: {
    icon: string; label: string; color: string; value: number; onChange(v: number): void;
}) {
    return (
        <div className="flex items-center gap-0.5 bg-surface-0 rounded px-1.5 py-1 border border-border-subtle">
            {icon && <span className={`material-symbols-outlined text-[11px] ${color} mr-0.5`}>{icon}</span>}
            <input type="number" value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full bg-transparent text-[11px] font-mono text-text-primary outline-none min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            <span className={`text-[9px] ${color} font-medium`}>{label}</span>
        </div>
    );
}

// ── CalibrationModal ──────────────────────────────────────────────────────────
function CalibrationModal({ onClose }: { onClose(): void }) {
    const currentFrame = useTrackingStore(s => s.currentFrame);
    const wsStatus = useTrackingStore(s => s.wsStatus);

    const [shapes, setShapes] = useState<Shape[]>([]);
    const [pick, setPick] = useState<PickState | null>(null);
    const [pending, setPending] = useState<Pending | null>(null);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<'success' | 'error' | null>(null);
    const [selectedShapeId, setSelectedShapeId] = useState<number | null>(null);

    const nextId = useRef(1);
    const sidebarScrollRef = useRef<HTMLDivElement>(null);
    const camRef = useRef<HTMLImageElement>(null);
    const fpRef = useRef<HTMLImageElement>(null);
    const camZoom = useRef<ZoomHandle>(null);
    const fpZoom = useRef<ZoomHandle>(null);

    // Auto-scroll sidebar when selection changes
    useEffect(() => {
        if (selectedShapeId !== null) {
            const el = document.querySelector(`[data-shape-id="${selectedShapeId}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [selectedShapeId]);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                cancelPick();
                setSelectedShapeId(null);
                onClose();
                return;
            }

            // Keyboard movement logic
            if (selectedShapeId !== null && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
                const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;

                const cW = camRef.current?.naturalWidth || 1280;
                const cH = camRef.current?.naturalHeight || 720;
                const fW = fpRef.current?.naturalWidth || 1000;
                const fH = fpRef.current?.naturalHeight || 1000;

                setShapes(prev => prev.map(s => {
                    if (s.id !== selectedShapeId) return s;
                    return {
                        ...s,
                        camera: s.camera.map(p => ({
                            x: Math.max(0, Math.min(1, p.x + dx / cW)),
                            y: Math.max(0, Math.min(1, p.y + dy / cH)),
                        })),
                        floorPlan: s.floorPlan.map(p => ({
                            x: Math.max(0, Math.min(1, p.x + dx / fW)),
                            y: Math.max(0, Math.min(1, p.y + dy / fH)),
                        }))
                    };
                }));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    }, [onClose, selectedShapeId, cancelPick]);

    const cancelPick = () => { setPick(null); setPending(null); };

    const startAdd = (tool: ToolType) => {
        setPick({ tool, side: 'camera', pointIdx: 0 });
        setPending({ camera: [], floorPlan: [] });
        setResult(null);
    };

    // ── Handle click (point only; line/ellipse use drag) ──
    const handleClick = useCallback((clickSide: 'camera' | 'floorPlan', x: number, y: number) => {
        if (!pick || !pending) return;
        if (DRAG_TOOLS.includes(pick.tool)) return;

        const expectedSide = pick.side === 'camera' ? 'camera' : 'floorPlan';
        if (clickSide !== expectedSide) return;

        const needed = PTS_CLICK[pick.tool];
        const newPending: Pending = {
            camera: clickSide === 'camera' ? [...pending.camera, { x, y }] : pending.camera,
            floorPlan: clickSide === 'floorPlan' ? [...pending.floorPlan, { x, y }] : pending.floorPlan,
        };
        setPending(newPending);

        if (clickSide === 'camera') {
            if (newPending.camera.length < needed) {
                setPick({ ...pick, pointIdx: pick.pointIdx + 1 });
            } else {
                setPick({ ...pick, side: 'floor', pointIdx: 0 });
            }
        } else {
            if (newPending.floorPlan.length < needed) {
                setPick({ ...pick, pointIdx: pick.pointIdx + 1 });
            } else {
                setShapes(prev => [...prev, {
                    id: nextId.current++,
                    type: pick.tool,
                    camera: newPending.camera,
                    floorPlan: newPending.floorPlan,
                }]);
                setPick(null);
                setPending(null);
            }
        }
    }, [pick, pending]);

    // ── Handle drag end (line + ellipse) ──
    const handleDrag = useCallback((dragSide: 'camera' | 'floorPlan', x1: number, y1: number, x2: number, y2: number) => {
        if (!pick || !pending) return;
        if (!DRAG_TOOLS.includes(pick.tool)) return;

        const expectedSide = pick.side === 'camera' ? 'camera' : 'floorPlan';
        if (dragSide !== expectedSide) return;

        const pts: NormPt[] = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        const newPending: Pending = {
            camera: dragSide === 'camera' ? pts : pending.camera,
            floorPlan: dragSide === 'floorPlan' ? pts : pending.floorPlan,
        };
        setPending(newPending);

        if (dragSide === 'camera') {
            setPick({ ...pick, side: 'floor', pointIdx: 0 });
        } else {
            setShapes(prev => [...prev, {
                id: nextId.current++,
                type: pick.tool,
                camera: newPending.camera,
                floorPlan: newPending.floorPlan,
            }]);
            setPick(null);
            setPending(null);
        }
    }, [pick, pending]);

    const onCamClick = useCallback((x: number, y: number) => handleClick('camera', x, y), [handleClick]);
    const onFpClick = useCallback((x: number, y: number) => handleClick('floorPlan', x, y), [handleClick]);
    const onCamDrag = useCallback((x1: number, y1: number, x2: number, y2: number) => handleDrag('camera', x1, y1, x2, y2), [handleDrag]);
    const onFpDrag = useCallback((x1: number, y1: number, x2: number, y2: number) => handleDrag('floorPlan', x1, y1, x2, y2), [handleDrag]);

    const removeShape = (id: number) => {
        setShapes(s => s.filter(x => x.id !== id));
        if (selectedShapeId === id) setSelectedShapeId(null);
        setResult(null);
    };

    const editPx = useCallback((id: number, side: 'camera' | 'floorPlan', pi: number, axis: 'x' | 'y', px: number) => {
        const cW = camRef.current?.naturalWidth || 1280;
        const cH = camRef.current?.naturalHeight || 720;
        const fW = fpRef.current?.naturalWidth || 1000;
        const fH = fpRef.current?.naturalHeight || 1000;
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
        const cW = camRef.current?.naturalWidth || 1280;
        const cH = camRef.current?.naturalHeight || 720;
        const fW = fpRef.current?.naturalWidth || 1000;
        const fH = fpRef.current?.naturalHeight || 1000;
        setSaving(true); setResult(null);
        try {
            const res = await fetch(`${API_BASE}/api/lab_management/settings/mapping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shapes: shapes.map(s => ({
                        type: s.type,
                        camera: s.camera.map(p => [Math.round(p.x * cW), Math.round(p.y * cH)]),
                        floor_plan: s.floorPlan.map(p => [Math.round(p.x * fW), Math.round(p.y * fH)]),
                    })),
                }),
            });
            setResult(res.ok ? 'success' : 'error');
        } catch { setResult('error'); }
        finally { setSaving(false); }
    };

    const isCamPicking = pick?.side === 'camera';
    const isFpPicking = pick?.side === 'floor';
    const isDragTool = pick ? DRAG_TOOLS.includes(pick.tool) : false;

    const stepLabel = (() => {
        if (!pick) return null;
        const on = pick.side === 'camera' ? 'camera frame' : 'floor plan';
        if (pick.tool === 'point') return `Click a point on the ${on}`;
        if (pick.tool === 'line') return `Drag to draw line on the ${on}`;
        return null;
    })();

    const toolBtns: { tool: ToolType; icon: string; label: string }[] = [
        { tool: 'point', icon: 'location_on', label: 'Point' },
        { tool: 'line', icon: 'timeline', label: 'Line' },
    ];

    // Overlay factories — close over latest shapes/pending/pick
    const camOverlay = (view: ViewState, cW: number, cH: number) => (
        <DotsOverlay shapes={shapes} pending={pending} pickTool={pick?.tool ?? null}
            side="camera" view={view} cW={cW} cH={cH}
            selectedShapeId={selectedShapeId}
            onShapeDoubleClick={setSelectedShapeId} />
    );
    const fpOverlay = (view: ViewState, cW: number, cH: number) => (
        <DotsOverlay shapes={shapes} pending={pending} pickTool={pick?.tool ?? null}
            side="floorPlan" view={view} cW={cW} cH={cH}
            selectedShapeId={selectedShapeId}
            onShapeDoubleClick={setSelectedShapeId} />
    );

    const modal = (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            style={{ zIndex: 9999 }} onClick={onClose}>
            <div className="bg-surface-1 border border-border-strong rounded-[var(--radius-xl)] shadow-2xl flex flex-col"
                style={{ width: 'calc(100vw - 3rem)', height: 'calc(100vh - 3rem)', zIndex: 10000 }}
                onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-border-default flex-wrap gap-y-2">
                    <span className="material-symbols-outlined text-accent shrink-0">map</span>
                    <div className="shrink-0 mr-1">
                        <h2 className="text-sm font-bold text-text-primary">2D Mapping Calibration</h2>
                        <p className="text-[10px] text-text-tertiary">Place shapes on both views to define coordinate mapping</p>
                    </div>

                    {/* Tool buttons */}
                    <div className="flex items-center gap-1.5">
                        {toolBtns.map(tb => (
                            <button key={tb.tool}
                                onClick={() => { cancelPick(); startAdd(tb.tool); }}
                                disabled={!!pick}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border transition-all
                                    disabled:opacity-40 disabled:cursor-not-allowed
                                    ${pick?.tool === tb.tool
                                        ? 'bg-accent border-accent text-white'
                                        : 'bg-surface-2 border-border-default text-text-secondary hover:border-accent hover:text-accent'}`}>
                                <span className="material-symbols-outlined text-sm">{tb.icon}</span>
                                + {tb.label}
                            </button>
                        ))}
                    </div>

                    {/* Step hint */}
                    {stepLabel && (
                        <div className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-[var(--radius-md)] px-3 py-1.5">
                            <span className="material-symbols-outlined text-accent text-sm animate-pulse">my_location</span>
                            <span className="text-xs text-accent font-medium">{stepLabel}</span>
                            <button onClick={cancelPick}
                                className="ml-1 text-[10px] text-accent/70 hover:text-accent underline underline-offset-2">
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Right controls */}
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                        <button onClick={() => { setShapes([]); cancelPick(); setResult(null); }}
                            disabled={shapes.length === 0 && !pick}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-border-default text-xs text-text-secondary hover:border-danger hover:text-danger disabled:opacity-40 transition-all">
                            <span className="material-symbols-outlined text-sm">delete_sweep</span>
                            Clear all
                        </button>
                        <div className="w-px h-5 bg-border-subtle" />
                        <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${shapes.length >= 4 ? 'border-success/40 text-success bg-success/10' : 'border-border-subtle text-text-tertiary'}`}>
                            {shapes.length} shape{shapes.length !== 1 ? 's' : ''}
                        </span>
                        <button onClick={handleSave} disabled={shapes.length === 0 || saving || !!pick}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius-md)] bg-success text-white text-xs font-medium hover:bg-success/90 disabled:opacity-40 transition-all">
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
                    <div className="flex-1 min-w-0 p-4 flex flex-col gap-3 min-h-0">
                        <p className="shrink-0 text-[11px] text-text-tertiary">
                            <span className="text-accent font-medium">Scroll / ±</span> to zoom ·
                            <span className="text-accent font-medium ml-1">Drag</span> to pan ·
                            <span className="text-accent font-medium ml-1">Line / Ellipse:</span> drag to draw
                        </p>
                        <div className="flex gap-4 flex-1 min-h-0">
                            <ZoomableCanvas ref={camZoom} label="Camera Frame"
                                labelExtra={wsStatus !== 'connected' && <span className="text-warning normal-case font-normal">(no stream)</span>}
                                isPicking={isCamPicking}
                                isDragTool={isDragTool && isCamPicking}
                                activeTool={pick?.tool ?? null}
                                onNormClick={onCamClick}
                                onNormDragEnd={onCamDrag}
                                overlay={camOverlay}>
                                {currentFrame
                                    ? <img ref={camRef} src={currentFrame} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain bg-black" />
                                    : <div className="absolute inset-0 bg-surface-0 flex flex-col items-center justify-center gap-2">
                                        <span className="material-symbols-outlined text-5xl text-text-tertiary">videocam_off</span>
                                        <p className="text-xs text-text-tertiary">No live frame</p>
                                    </div>
                                }
                                <ShapeLayer shapes={shapes} pending={pending} pickTool={pick?.tool ?? null} side="camera" />
                            </ZoomableCanvas>

                            <ZoomableCanvas ref={fpZoom} label="Floor Plan"
                                isPicking={isFpPicking}
                                isDragTool={isDragTool && isFpPicking}
                                activeTool={pick?.tool ?? null}
                                onNormClick={onFpClick}
                                onNormDragEnd={onFpDrag}
                                overlay={fpOverlay}>
                                <img ref={fpRef} src="/labmap.svg" alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain bg-surface-0" />
                                <ShapeLayer shapes={shapes} pending={pending} pickTool={pick?.tool ?? null} side="floorPlan" />
                            </ZoomableCanvas>
                        </div>
                    </div>

                    <Sidebar shapes={shapes} pending={pending} pickTool={pick?.tool ?? null}
                        onRemove={removeShape} onEditPx={editPx}
                        camRef={camRef} fpRef={fpRef}
                        selectedShapeId={selectedShapeId} onSelect={setSelectedShapeId} />
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}

// ── Settings card ─────────────────────────────────────────────────────────────
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
                            Place points, lines, and ellipses on the camera view and floor plan to
                            define the coordinate mapping used by the backend.
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
