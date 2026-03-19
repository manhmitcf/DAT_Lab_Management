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
type ModeType = 'mapping' | 'counting';

interface NormPt { x: number; y: number; }

// Mapping Service — point pairs between camera frame and 2D floor plan
interface PointPair { id: number; camera: NormPt; map: NormPt; }
interface MapPick {
    side: 'camera' | 'map';
    pendingCam: NormPt | null; // set after camera click, before map click
}

// Counting Service — virtual tripwire on camera frame
interface CountingCfg {
    lineStart:      NormPt | null;
    lineEnd:        NormPt | null;
    insidePoint:    NormPt | null;
    crossingMargin: number;
}
type CountingPick = 'line' | 'inside' | null;

// Unified selection for arrow-key nudging
type SelPt =
    | { scope: 'mapping';  pairId: number; side: 'camera' | 'map' }
    | { scope: 'counting'; pt: 'lineStart' | 'lineEnd' | 'insidePoint' };

interface ViewState { scale: number; tx: number; ty: number; }

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
const gc    = (i: number) => COLORS[i % COLORS.length];
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const round2 = (n: number) => +n.toFixed(2);

const HOVER_DRAG_MS = 500;  // hover this long to enable drag on next mousedown
const PRESS_DRAG_MS  = 300;  // hold mousedown this long to start drag

export interface ZoomHandle { zoomIn(): void; zoomOut(): void; reset(): void; }

// ── ShapeDot ──────────────────────────────────────────────────────────────────
function ShapeDot({ x, y, size, color, label, isPending = false,
    isSelected = false, isPartner = false, isHovered = false, isDragging = false,
    onClick, onDoubleClick, onMouseEnter, onMouseLeave, onMouseDown }: {
    x: number; y: number; size: number; color: string; label?: string;
    isPending?: boolean; isSelected?: boolean; isPartner?: boolean; isHovered?: boolean; isDragging?: boolean;
    onClick?: () => void;
    onDoubleClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onMouseDown?: (e: React.MouseEvent) => void;
}) {
    const interactive = !!(onClick || onDoubleClick || onMouseDown);
    const glow = isSelected || isDragging
        ? `0 0 0 3px ${color}66, 0 0 8px ${color}44, 0 1px 6px rgba(0,0,0,0.6)`
        : isHovered
            ? `0 0 0 2.5px ${color}88, 0 0 10px ${color}55, 0 1px 5px rgba(0,0,0,0.5)`
            : isPartner
                ? `0 0 0 2.5px ${color}55, 0 1px 5px rgba(0,0,0,0.5)`
                : '0 1px 4px rgba(0,0,0,0.55)';
    return (
        <div
            className={`absolute flex items-center justify-center ${isPending ? 'animate-pulse' : ''}`}
            style={{
                left: x, top: y,
                width:  isSelected || isHovered || isDragging ? size + 4 : size,
                height: isSelected || isHovered || isDragging ? size + 4 : size,
                transform: 'translate(-50%, -50%)',
                backgroundColor: color,
                borderRadius: '50%',
                border: `${isSelected || isPartner || isHovered || isDragging ? 2 : 1.5}px solid rgba(255,255,255,${isSelected || isHovered || isDragging ? 1 : 0.85})`,
                boxShadow: glow,
                opacity: isPending ? 0.75 : 1,
                fontSize: '6px', lineHeight: 1, color: 'white', fontWeight: 'bold',
                userSelect: 'none',
                pointerEvents: interactive ? 'auto' : 'none',
                cursor: isDragging ? 'grabbing' : interactive ? 'grab' : undefined,
                transition: isDragging ? 'none' : 'width .12s, height .12s, box-shadow .12s',
                zIndex: isSelected || isDragging ? 20 : isPartner || isHovered ? 10 : 1,
            }}
            onMouseDown={interactive ? (e) => { e.stopPropagation(); onMouseDown?.(e); } : undefined}
            onClick={interactive && onClick ? e => { e.stopPropagation(); onClick(); } : undefined}
            onDoubleClick={interactive && onDoubleClick ? e => { e.stopPropagation(); onDoubleClick(); } : undefined}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {label}
        </div>
    );
}

// ── DraggableShapeDot: hover/press-to-drag ────────────────────────────────────
function DraggableShapeDot(props: {
    x: number; y: number; size: number; color: string; label?: string;
    isSelected?: boolean; isPartner?: boolean;
    clientToNorm: (cx: number, cy: number) => { x: number; y: number } | null;
    onMove: (norm: { x: number; y: number }) => void;
    onClick?: () => void;
    onDoubleClick?: () => void;
    disabled?: boolean;
}) {
    const { clientToNorm, onMove, onClick, onDoubleClick, disabled, ...dotProps } = props;
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [hoverDragReady, setHoverDragReady] = useState(false);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didEnterDragRef = useRef(false);  // true if we started drag (hover-ready or press timer)

    const clearHoverTimer = useCallback(() => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        setHoverDragReady(false);
    }, []);

    const clearPressTimer = useCallback(() => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
    }, []);

    const startDrag = useCallback((clientX: number, clientY: number) => {
        const n = clientToNorm(clientX, clientY);
        if (!n) return;
        didEnterDragRef.current = true;
        setIsDragging(true);
        clearPressTimer();
        clearHoverTimer();

        const onMM = (e: MouseEvent) => {
            const nn = clientToNorm(e.clientX, e.clientY);
            if (!nn) return;
            onMove(nn);
        };
        const onMU = (e: MouseEvent) => {
            const nn = clientToNorm(e.clientX, e.clientY);
            if (nn) onMove(nn);
            setIsDragging(false);
            window.removeEventListener('mousemove', onMM);
            window.removeEventListener('mouseup', onMU);
        };
        window.addEventListener('mousemove', onMM);
        window.addEventListener('mouseup', onMU);
    }, [clientToNorm, onMove, clearPressTimer, clearHoverTimer]);

    const handleMouseEnter = useCallback(() => {
        if (disabled) return;
        setIsHovered(true);
        hoverTimerRef.current = setTimeout(() => setHoverDragReady(true), HOVER_DRAG_MS);
    }, [disabled]);

    const handleMouseLeave = useCallback(() => {
        setIsHovered(false);
        clearHoverTimer();
    }, [clearHoverTimer]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        if (hoverDragReady) {
            startDrag(e.clientX, e.clientY);
            return;
        }
        pressTimerRef.current = setTimeout(() => {
            startDrag(e.clientX, e.clientY);
        }, PRESS_DRAG_MS);
        const cancelPress = () => {
            clearPressTimer();
            window.removeEventListener('mouseup', cancelPress);
        };
        window.addEventListener('mouseup', cancelPress, { once: true });
    }, [disabled, hoverDragReady, startDrag]);

    const handleClick = useCallback(() => {
        clearPressTimer();
        if (didEnterDragRef.current) {
            didEnterDragRef.current = false;
            return;
        }
        onClick?.();
    }, [onClick, clearPressTimer]);

    useEffect(() => () => {
        clearHoverTimer();
        clearPressTimer();
    }, [clearHoverTimer, clearPressTimer]);

    if (disabled) {
        return (
            <ShapeDot {...dotProps} isSelected={props.isSelected} isPartner={props.isPartner}
                isHovered={isHovered} onClick={onClick} onDoubleClick={onDoubleClick}
                onMouseDown={e => e.stopPropagation()}
                onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
        );
    }

    return (
        <ShapeDot {...dotProps} isSelected={props.isSelected} isPartner={props.isPartner}
            isHovered={isHovered} isDragging={isDragging}
            onClick={handleClick} onDoubleClick={onDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
    );
}

// ── MappingDotsOverlay ────────────────────────────────────────────────────────
function MappingDotsOverlay({ pairs, mapPick, sel, onSelect, onMovePoint, clientToNorm, side, view, cW, cH }: {
    pairs: PointPair[];
    mapPick: MapPick | null;
    sel: SelPt | null;
    onSelect: (s: SelPt) => void;
    onMovePoint: (pairId: number, side: 'camera' | 'map', norm: NormPt) => void;
    clientToNorm: (cx: number, cy: number) => { x: number; y: number } | null;
    side: 'camera' | 'map';
    view: ViewState; cW: number; cH: number;
}) {
    if (!cW || !cH) return null;
    const toS = (p: NormPt) => ({ x: view.tx + p.x * cW * view.scale, y: view.ty + p.y * cH * view.scale });
    const isSel  = (id: number) => sel?.scope === 'mapping' && sel.pairId === id && sel.side === side;
    const isPart = (id: number) => sel?.scope === 'mapping' && sel.pairId === id && sel.side !== side;
    return (
        <>
            {pairs.map((pair, i) => {
                const pt = side === 'camera' ? pair.camera : pair.map;
                const { x, y } = toS(pt);
                return (
                    <DraggableShapeDot key={pair.id} x={x} y={y} size={10} color={gc(i)}
                        label={`p${i + 1}`}
                        isSelected={isSel(pair.id)} isPartner={isPart(pair.id)}
                        clientToNorm={clientToNorm}
                        onMove={(norm) => onMovePoint(pair.id, side, norm)}
                        onClick={() => onSelect({ scope: 'mapping', pairId: pair.id, side })} />
                );
            })}
            {/* Pending camera point while waiting for map click */}
            {mapPick?.side === 'map' && mapPick.pendingCam && side === 'camera' && (() => {
                const { x, y } = toS(mapPick.pendingCam);
                return <ShapeDot x={x} y={y} size={10} color={gc(pairs.length)}
                    label={`p${pairs.length + 1}`} isPending />;
            })()}
        </>
    );
}

// ── CountingDotsOverlay ───────────────────────────────────────────────────────
function CountingDotsOverlay({ counting, sel, onSelect, onMovePoint, onMoveLine, clientToNorm, cntPick, view, cW, cH }: {
    counting: CountingCfg;
    sel: SelPt | null;
    onSelect: (s: SelPt) => void;
    onMovePoint: (pt: 'lineStart' | 'lineEnd' | 'insidePoint', norm: NormPt) => void;
    onMoveLine: (delta: NormPt) => void;
    clientToNorm: (cx: number, cy: number) => { x: number; y: number } | null;
    cntPick: CountingPick;
    view: ViewState; cW: number; cH: number;
}) {
    const [lineHovered, setLineHovered] = useState(false);
    const [lineDragging, setLineDragging] = useState(false);
    const [lineHoverReady, setLineHoverReady] = useState(false);
    const lineHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const linePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lineStartNormRef = useRef<{ x: number; y: number } | null>(null);

    if (!cW || !cH) return null;
    const toS = (p: NormPt) => ({ x: view.tx + p.x * cW * view.scale, y: view.ty + p.y * cH * view.scale });
    const isSel = (pt: 'lineStart' | 'lineEnd' | 'insidePoint') =>
        sel?.scope === 'counting' && (sel as { scope: 'counting'; pt: string }).pt === pt;

    const LINE_CLR   = '#3b82f6';
    const INSIDE_CLR = '#10b981';

    // When picking (line or inside), dots/line must NOT capture events so canvas receives clicks/drags
    const lineDotsInteractive = cntPick === null;

    const lineStartScreen = counting.lineStart ? toS(counting.lineStart) : null;
    const lineEndScreen   = counting.lineEnd   ? toS(counting.lineEnd)   : null;

    const startLineDrag = useCallback((clientX: number, clientY: number) => {
        const n = clientToNorm(clientX, clientY);
        if (!n || !counting.lineStart || !counting.lineEnd) return;
        lineStartNormRef.current = n;
        setLineDragging(true);
        if (lineHoverTimerRef.current) {
            clearTimeout(lineHoverTimerRef.current);
            lineHoverTimerRef.current = null;
        }
        setLineHoverReady(false);
        if (linePressTimerRef.current) {
            clearTimeout(linePressTimerRef.current);
            linePressTimerRef.current = null;
        }

        const onMM = (e: MouseEvent) => {
            const nn = clientToNorm(e.clientX, e.clientY);
            if (!nn || !lineStartNormRef.current) return;
            const dx = nn.x - lineStartNormRef.current.x;
            const dy = nn.y - lineStartNormRef.current.y;
            lineStartNormRef.current = nn;
            onMoveLine({ x: dx, y: dy });
        };
        const onMU = () => {
            setLineDragging(false);
            lineStartNormRef.current = null;
            window.removeEventListener('mousemove', onMM);
            window.removeEventListener('mouseup', onMU);
        };
        window.addEventListener('mousemove', onMM);
        window.addEventListener('mouseup', onMU);
    }, [clientToNorm, onMoveLine, counting.lineStart, counting.lineEnd]);

    const handleLineMouseEnter = useCallback(() => {
        if (!lineDotsInteractive) return;
        setLineHovered(true);
        lineHoverTimerRef.current = setTimeout(() => setLineHoverReady(true), HOVER_DRAG_MS);
    }, [lineDotsInteractive]);

    const handleLineMouseLeave = useCallback(() => {
        setLineHovered(false);
        if (lineHoverTimerRef.current) {
            clearTimeout(lineHoverTimerRef.current);
            lineHoverTimerRef.current = null;
        }
        setLineHoverReady(false);
    }, []);

    const handleLineMouseDown = useCallback((e: React.MouseEvent) => {
        if (!lineDotsInteractive) return;
        e.preventDefault();
        e.stopPropagation();
        if (lineHoverReady) {
            startLineDrag(e.clientX, e.clientY);
            return;
        }
        linePressTimerRef.current = setTimeout(() => startLineDrag(e.clientX, e.clientY), PRESS_DRAG_MS);
        const cancelPress = () => {
            if (linePressTimerRef.current) {
                clearTimeout(linePressTimerRef.current);
                linePressTimerRef.current = null;
            }
            window.removeEventListener('mouseup', cancelPress);
        };
        window.addEventListener('mouseup', cancelPress, { once: true });
    }, [lineDotsInteractive, lineHoverReady, startLineDrag]);

    useEffect(() => () => {
        if (lineHoverTimerRef.current) clearTimeout(lineHoverTimerRef.current);
        if (linePressTimerRef.current) clearTimeout(linePressTimerRef.current);
    }, []);

    return (
        <>
            {/* Line hover highlight + hit area - draggable when hover/press long enough */}
            {lineStartScreen && lineEndScreen && lineDotsInteractive && (
                <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ zIndex: 1, pointerEvents: 'none' }}>
                    <line
                        x1={lineStartScreen.x} y1={lineStartScreen.y}
                        x2={lineEndScreen.x}   y2={lineEndScreen.y}
                        stroke={lineHovered || lineDragging ? '#60a5fa' : '#3b82f6'}
                        strokeWidth={lineHovered || lineDragging ? 4 : 2.5}
                        opacity={1}
                    />
                </svg>
            )}
            {lineStartScreen && lineEndScreen && lineDotsInteractive && (
                <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ zIndex: 2 }}>
                    <line
                        x1={lineStartScreen.x} y1={lineStartScreen.y}
                        x2={lineEndScreen.x}   y2={lineEndScreen.y}
                        stroke="transparent"
                        strokeWidth={16}
                        style={{ pointerEvents: 'stroke', cursor: lineDragging ? 'grabbing' : 'grab' }}
                        onMouseEnter={handleLineMouseEnter}
                        onMouseLeave={handleLineMouseLeave}
                        onMouseDown={handleLineMouseDown}
                    />
                </svg>
            )}
            {counting.lineStart && (() => {
                const { x, y } = toS(counting.lineStart!);
                return <DraggableShapeDot x={x} y={y} size={9} color={LINE_CLR} label="S"
                    isSelected={isSel('lineStart')}
                    clientToNorm={clientToNorm}
                    onMove={(norm) => onMovePoint('lineStart', norm)}
                    onClick={lineDotsInteractive ? () => onSelect({ scope: 'counting', pt: 'lineStart' }) : undefined}
                    disabled={!lineDotsInteractive} />;
            })()}
            {counting.lineEnd && (() => {
                const { x, y } = toS(counting.lineEnd!);
                return <DraggableShapeDot x={x} y={y} size={9} color={LINE_CLR} label="E"
                    isSelected={isSel('lineEnd')}
                    clientToNorm={clientToNorm}
                    onMove={(norm) => onMovePoint('lineEnd', norm)}
                    onClick={lineDotsInteractive ? () => onSelect({ scope: 'counting', pt: 'lineEnd' }) : undefined}
                    disabled={!lineDotsInteractive} />;
            })()}
            {counting.insidePoint && (() => {
                const { x, y } = toS(counting.insidePoint!);
                return <DraggableShapeDot x={x} y={y} size={10} color={INSIDE_CLR} label="I"
                    isSelected={isSel('insidePoint')}
                    clientToNorm={clientToNorm}
                    onMove={(norm) => onMovePoint('insidePoint', norm)}
                    onClick={() => onSelect({ scope: 'counting', pt: 'insidePoint' })} />;
            })()}
        </>
    );
}

// ── ZoomableCanvas ────────────────────────────────────────────────────────────
const ZoomableCanvas = forwardRef<ZoomHandle, {
    label: string;
    labelExtra?: React.ReactNode;
    isPicking: boolean;
    isDragTool: boolean;
    activeTool?: 'line' | 'point' | null;
    onNormClick(x: number, y: number): void;
    onNormDragEnd(x1: number, y1: number, x2: number, y2: number): void;
    onCanvasClick?: () => void;
    overlay?: (view: ViewState, cW: number, cH: number, clientToNorm: (cx: number, cy: number) => { x: number; y: number } | null) => React.ReactNode;
    children: React.ReactNode;
}>(function ZoomableCanvas({
    label, labelExtra, isPicking, isDragTool, activeTool,
    onNormClick, onNormDragEnd, onCanvasClick, overlay, children,
}, ref) {
    const [view, setView]               = useState<ViewState>({ scale: 1, tx: 0, ty: 0 });
    const [isDragging, setIsDragging]   = useState(false);
    const [drawPrev, setDrawPrev]       = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);
    const [cSize, setCSize]             = useState({ w: 0, h: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const panRef  = useRef({ on: false, moved: false, sx: 0, sy: 0, stx: 0, sty: 0 });
    const drawRef = useRef({ on: false, snx: 0, sny: 0 });

    useImperativeHandle(ref, () => ({
        zoomIn:  () => setView(v => applyZoom(v, 1.25, null, containerRef.current)),
        zoomOut: () => setView(v => applyZoom(v, 0.8,  null, containerRef.current)),
        reset:   () => setView({ scale: 1, tx: 0, ty: 0 }),
    }));

    useEffect(() => {
        const el = containerRef.current; if (!el) return;
        const ro = new ResizeObserver(entries => {
            const r = entries[0].contentRect;
            setCSize({ w: r.width, h: r.height });
        });
        ro.observe(el);
        setCSize({ w: el.offsetWidth, h: el.offsetHeight });
        return () => ro.disconnect();
    }, []);

    function applyZoom(v: ViewState, f: number, cur: { x: number; y: number } | null, el: HTMLElement | null): ViewState {
        const r = el?.getBoundingClientRect();
        const cx = cur ? cur.x - (r?.left ?? 0) : (r?.width  ?? 0) / 2;
        const cy = cur ? cur.y - (r?.top  ?? 0) : (r?.height ?? 0) / 2;
        const ns = Math.max(0.25, Math.min(10, v.scale * f));
        return { scale: ns, tx: cx - ((cx - v.tx) / v.scale) * ns, ty: cy - ((cy - v.ty) / v.scale) * ns };
    }

    function normPos(clientX: number, clientY: number, v: ViewState, r: DOMRect) {
        return {
            x: clamp((clientX - r.left - v.tx) / (r.width  * v.scale)),
            y: clamp((clientY - r.top  - v.ty) / (r.height * v.scale)),
        };
    }
    const clientToNorm = useCallback((cx: number, cy: number) => {
        const r = containerRef.current?.getBoundingClientRect();
        if (!r) return null;
        return normPos(cx, cy, view, r);
    }, [view]);

    useEffect(() => {
        const el = containerRef.current; if (!el) return;
        const h = (e: WheelEvent) => {
            e.preventDefault();
            setView(v => applyZoom(v, e.deltaY < 0 ? 1.1 : 0.9, { x: e.clientX, y: e.clientY }, el));
        };
        el.addEventListener('wheel', h, { passive: false });
        return () => el.removeEventListener('wheel', h);
    }, []);

    const onMD = useCallback((e: React.MouseEvent) => {
        const r = containerRef.current?.getBoundingClientRect(); if (!r) return;
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
        const r = containerRef.current?.getBoundingClientRect(); if (!r) return;
        if (drawRef.current.on) {
            const { x, y } = normPos(e.clientX, e.clientY, view, r);
            setDrawPrev({ sx: drawRef.current.snx, sy: drawRef.current.sny, ex: x, ey: y });
        } else if (panRef.current.on) {
            const dx = e.clientX - panRef.current.sx, dy = e.clientY - panRef.current.sy;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                panRef.current.moved = true;
                setView(v => ({ ...v, tx: panRef.current.stx + dx, ty: panRef.current.sty + dy }));
            }
        }
    }, [view]);

    const onMU = useCallback((e: React.MouseEvent) => {
        const r = containerRef.current?.getBoundingClientRect(); if (!r) return;
        if (drawRef.current.on) {
            const { snx, sny } = drawRef.current;
            drawRef.current.on = false; setDrawPrev(null);
            const { x, y } = normPos(e.clientX, e.clientY, view, r);
            onNormDragEnd(snx, sny, x, y);
        } else if (panRef.current.on) {
            const moved = panRef.current.moved;
            panRef.current.on = false; setIsDragging(false);
            if (!moved) {
                const { x, y } = normPos(e.clientX, e.clientY, view, r);
                if (isPicking && !isDragTool) onNormClick(x, y);
                else if (!isPicking) onCanvasClick?.();
            }
        }
    }, [view, isPicking, isDragTool, onNormClick, onNormDragEnd, onCanvasClick]);

    const cursor = isPicking ? 'crosshair' : isDragging ? 'grabbing' : 'grab';

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
                }}>
                {/* Zoom-transformed layer */}
                <div className="absolute inset-0"
                    style={{ transform: `translate(${view.tx}px,${view.ty}px) scale(${view.scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
                    {children}
                    {/* Line drag preview */}
                    {drawPrev && activeTool === 'line' && (
                        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                            <line x1={`${drawPrev.sx * 100}%`} y1={`${drawPrev.sy * 100}%`}
                                  x2={`${drawPrev.ex * 100}%`} y2={`${drawPrev.ey * 100}%`}
                                  stroke="rgba(59,130,246,0.75)" strokeWidth="2" strokeDasharray="6,3" />
                        </svg>
                    )}
                </div>
                {/* Zoom-invariant overlay */}
                <div className="absolute inset-0 pointer-events-none">
                    {overlay?.(view, cSize.w, cSize.h, clientToNorm)}
                </div>
                {isPicking && !drawPrev && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <span className="material-symbols-outlined text-accent/20 text-9xl">
                            {isDragTool ? 'show_chart' : 'add_circle'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
});

// ── CountingShapeLayer (inside zoom — scales with content) ────────────────────
function CountingShapeLayer({ counting }: { counting: CountingCfg }) {
    const { lineStart: s, lineEnd: e, insidePoint: ip } = counting;
    if (!s && !e) return null;
    const mx = s && e ? (s.x + e.x) / 2 : 0;
    const my = s && e ? (s.y + e.y) / 2 : 0;
    return (
        <div className="absolute inset-0 pointer-events-none">
            <svg className="absolute inset-0 w-full h-full overflow-visible">
                {s && e && (
                    <line x1={`${s.x*100}%`} y1={`${s.y*100}%`} x2={`${e.x*100}%`} y2={`${e.y*100}%`}
                        stroke="#3b82f6" strokeWidth="2.5" opacity="0.9" />
                )}
                {/* Dashed guide from midpoint to inside_point */}
                {s && e && ip && (
                    <line x1={`${mx*100}%`} y1={`${my*100}%`} x2={`${ip.x*100}%`} y2={`${ip.y*100}%`}
                        stroke="#10b981" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
                )}
            </svg>
        </div>
    );
}

// ── PxInput ───────────────────────────────────────────────────────────────────
function PxInput({ icon, label, color, value, onChange, highlight = false }: {
    icon: string; label: string; color: string; value: number;
    onChange(v: number): void; highlight?: boolean;
}) {
    return (
        <div className={`flex items-center gap-0.5 rounded px-1.5 py-1 border transition-colors
            ${highlight ? 'bg-accent/10 border-accent/40' : 'bg-surface-0 border-border-subtle'}`}>
            {icon && <span className={`material-symbols-outlined text-[11px] ${color} mr-0.5`}>{icon}</span>}
            <input type="number" value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full bg-transparent text-[11px] font-mono text-text-primary outline-none min-w-0
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            <span className={`text-[9px] ${color} font-medium`}>{label}</span>
        </div>
    );
}

// ── MappingSidebar ────────────────────────────────────────────────────────────
function MappingSidebar({ pairs, mapPick, sel, onRemove, onEditPx, camRef, fpRef }: {
    pairs: PointPair[];
    mapPick: MapPick | null;
    sel: SelPt | null;
    onRemove(id: number): void;
    onEditPx(id: number, side: 'camera' | 'map', axis: 'x' | 'y', px: number): void;
    camRef: React.RefObject<HTMLImageElement | null>;
    fpRef:  React.RefObject<HTMLImageElement | null>;
}) {
    const cW = camRef.current?.naturalWidth  || 1920;
    const cH = camRef.current?.naturalHeight || 1080;
    const mW = fpRef.current?.naturalWidth   || 1000;
    const mH = fpRef.current?.naturalHeight  || 1000;
    const px = (n: number, d: number) => Math.round(n * d);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!sel || sel.scope !== 'mapping') return;
        listRef.current?.querySelector<HTMLElement>(`[data-pair-id="${sel.pairId}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [sel]);

    return (
        <div className="w-64 shrink-0 border-l border-border-default flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border-subtle shrink-0">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Point Pairs</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">
                    <span className="text-success">cam</span> = camera px ·&nbsp;
                    <span className="text-accent">map</span> = floor plan px
                </p>
            </div>
            <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-border-subtle">
                {pairs.length === 0 && !mapPick && (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
                        <span className="material-symbols-outlined text-3xl text-text-tertiary">add_location_alt</span>
                        <p className="text-xs text-text-tertiary">Click "+ Add Point" to start.<br />Need ≥ 4 pairs.</p>
                    </div>
                )}
                {pairs.map((pair, i) => {
                    const isPairSel = sel?.scope === 'mapping' && sel.pairId === pair.id;
                    return (
                        <div key={pair.id} data-pair-id={pair.id}
                            className={`px-3 py-3 group transition-colors ${isPairSel ? 'bg-accent/5' : 'hover:bg-surface-2'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="size-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                    style={{ backgroundColor: gc(i) }}>
                                    {i + 1}
                                </div>
                                <span className="text-[11px] font-semibold text-text-primary font-mono">p{i + 1}</span>
                                {isPairSel && (
                                    <span className="text-[9px] text-accent bg-accent/10 border border-accent/20 rounded px-1 py-0.5 font-medium ml-1">↑↓←→</span>
                                )}
                                <button onClick={() => onRemove(pair.id)}
                                    className="ml-auto opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-all">
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1 mb-1">
                                <PxInput icon="videocam" label="x" color="text-success" value={px(pair.camera.x, cW)}
                                    highlight={isPairSel && sel?.side === 'camera'}
                                    onChange={v => onEditPx(pair.id, 'camera', 'x', v)} />
                                <PxInput icon="" label="y" color="text-success" value={px(pair.camera.y, cH)}
                                    highlight={isPairSel && sel?.side === 'camera'}
                                    onChange={v => onEditPx(pair.id, 'camera', 'y', v)} />
                                <PxInput icon="map" label="x" color="text-accent" value={px(pair.map.x, mW)}
                                    highlight={isPairSel && sel?.side === 'map'}
                                    onChange={v => onEditPx(pair.id, 'map', 'x', v)} />
                                <PxInput icon="" label="y" color="text-accent" value={px(pair.map.y, mH)}
                                    highlight={isPairSel && sel?.side === 'map'}
                                    onChange={v => onEditPx(pair.id, 'map', 'y', v)} />
                            </div>
                        </div>
                    );
                })}
                {mapPick && (
                    <div className="px-3 py-3 bg-accent/5 border-l-2 border-accent/40">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-accent text-sm animate-pulse">my_location</span>
                            <span className="text-[11px] text-accent font-medium">
                                {mapPick.side === 'camera' ? 'Click on Camera…' : 'Click on Floor Plan…'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── CountingSidebar ───────────────────────────────────────────────────────────
function CountingSidebar({ counting, sel, cntPick, setCounting, onEditPx, camRef }: {
    counting: CountingCfg;
    sel: SelPt | null;
    cntPick: CountingPick;
    setCounting: React.Dispatch<React.SetStateAction<CountingCfg>>;
    onEditPx(pt: 'lineStart' | 'lineEnd' | 'insidePoint', axis: 'x' | 'y', px: number): void;
    camRef: React.RefObject<HTMLImageElement | null>;
}) {
    const cW = camRef.current?.naturalWidth  || 1920;
    const cH = camRef.current?.naturalHeight || 1080;
    const px = (n: number, d: number) => Math.round(n * d);
    const isSel = (pt: 'lineStart' | 'lineEnd' | 'insidePoint') =>
        sel?.scope === 'counting' && (sel as { scope: 'counting'; pt: string }).pt === pt;

    const listRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!sel || sel.scope !== 'counting') return;
        const pt = (sel as { scope: 'counting'; pt: string }).pt;
        listRef.current?.querySelector<HTMLElement>(`[data-cnt-pt="${pt}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [sel]);

    const StatusBadge = ({ ok }: { ok: boolean }) => (
        <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ml-auto
            ${ok ? 'border-success/30 text-success bg-success/10' : 'border-border-subtle text-text-tertiary bg-surface-2'}`}>
            <span className={`size-1.5 rounded-full ${ok ? 'bg-success' : 'bg-text-tertiary'}`} />
            {ok ? 'Set' : 'Not set'}
        </span>
    );

    return (
        <div className="w-64 shrink-0 border-l border-border-default flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border-subtle shrink-0">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Counting Config</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">All coordinates in camera frame pixels</p>
            </div>
            <div ref={listRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                {/* Counting Line */}
                <div data-cnt-pt="lineStart"
                    className={`rounded-lg border p-3 transition-colors ${(isSel('lineStart') || isSel('lineEnd')) ? 'border-accent/40 bg-accent/5' : 'border-border-subtle'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="size-4 rounded-full bg-[#3b82f6]" />
                        <span className="text-[11px] font-semibold text-text-primary">Counting Line</span>
                        <StatusBadge ok={!!(counting.lineStart && counting.lineEnd)} />
                    </div>
                    {counting.lineStart && (
                        <div className="mb-2">
                            <p className="text-[9px] text-text-tertiary uppercase tracking-wider font-medium mb-1">Start (S)</p>
                            <div className="grid grid-cols-2 gap-1">
                                <PxInput icon="" label="x" color="text-[#3b82f6]" value={px(counting.lineStart.x, cW)}
                                    highlight={isSel('lineStart')} onChange={v => onEditPx('lineStart', 'x', v)} />
                                <PxInput icon="" label="y" color="text-[#3b82f6]" value={px(counting.lineStart.y, cH)}
                                    highlight={isSel('lineStart')} onChange={v => onEditPx('lineStart', 'y', v)} />
                            </div>
                        </div>
                    )}
                    {counting.lineEnd && (
                        <div data-cnt-pt="lineEnd">
                            <p className="text-[9px] text-text-tertiary uppercase tracking-wider font-medium mb-1">End (E)</p>
                            <div className="grid grid-cols-2 gap-1">
                                <PxInput icon="" label="x" color="text-[#3b82f6]" value={px(counting.lineEnd.x, cW)}
                                    highlight={isSel('lineEnd')} onChange={v => onEditPx('lineEnd', 'x', v)} />
                                <PxInput icon="" label="y" color="text-[#3b82f6]" value={px(counting.lineEnd.y, cH)}
                                    highlight={isSel('lineEnd')} onChange={v => onEditPx('lineEnd', 'y', v)} />
                            </div>
                        </div>
                    )}
                    {!counting.lineStart && (
                        <p className="text-[10px] text-text-tertiary italic">Drag on camera to draw line</p>
                    )}
                </div>

                {/* Inside Point */}
                <div data-cnt-pt="insidePoint"
                    className={`rounded-lg border p-3 transition-colors ${isSel('insidePoint') ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border-subtle'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="size-4 rounded-full bg-[#10b981]" />
                        <span className="text-[11px] font-semibold text-text-primary">Inside Point</span>
                        <StatusBadge ok={!!counting.insidePoint} />
                    </div>
                    {counting.insidePoint ? (
                        <div className="grid grid-cols-2 gap-1">
                            <PxInput icon="" label="x" color="text-[#10b981]" value={px(counting.insidePoint.x, cW)}
                                highlight={isSel('insidePoint')} onChange={v => onEditPx('insidePoint', 'x', v)} />
                            <PxInput icon="" label="y" color="text-[#10b981]" value={px(counting.insidePoint.y, cH)}
                                highlight={isSel('insidePoint')} onChange={v => onEditPx('insidePoint', 'y', v)} />
                        </div>
                    ) : (
                        <p className="text-[10px] text-text-tertiary italic">Click on camera after drawing line</p>
                    )}
                    <p className="text-[9px] text-text-tertiary mt-2 leading-relaxed">
                        Place inside the area to count as "entering"
                    </p>
                </div>

                {/* Crossing Margin */}
                <div className="rounded-lg border border-border-subtle p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-text-tertiary text-[16px]">width</span>
                        <span className="text-[11px] font-semibold text-text-primary">Crossing Margin</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="number" min={1} max={100}
                            value={counting.crossingMargin}
                            onChange={e => setCounting(p => ({ ...p, crossingMargin: Number(e.target.value) || 10 }))}
                            className="flex-1 bg-surface-0 border border-border-subtle rounded px-2 py-1 text-[12px] font-mono text-text-primary outline-none focus:border-accent transition-colors
                                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="text-[11px] text-text-tertiary">px</span>
                    </div>
                    <p className="text-[9px] text-text-tertiary mt-1.5">Tolerance zone around the line</p>
                </div>

                {/* Status summary */}
                <div className={`rounded-lg border p-3 text-[10px] leading-relaxed
                    ${counting.lineStart && counting.lineEnd && counting.insidePoint
                        ? 'border-success/30 bg-success/5 text-success'
                        : 'border-border-subtle text-text-tertiary'}`}>
                    {counting.lineStart && counting.lineEnd && counting.insidePoint
                        ? '✓ Ready to apply counting config'
                        : `Missing: ${[!counting.lineStart || !counting.lineEnd ? 'counting line' : '', !counting.insidePoint ? 'inside point' : ''].filter(Boolean).join(', ')}`
                    }
                </div>
            </div>
        </div>
    );
}

// ── CalibrationModal ──────────────────────────────────────────────────────────
function CalibrationModal({ onClose }: { onClose(): void }) {
    const currentFrame = useTrackingStore(s => s.currentFrame);
    const wsStatus     = useTrackingStore(s => s.wsStatus);

    const [mode, setMode]     = useState<ModeType>('mapping');

    // Mapping state
    const [pairs, setPairs]         = useState<PointPair[]>([]);
    const [mapPick, setMapPick]     = useState<MapPick | null>(null);
    const [mapSaving, setMapSaving] = useState(false);
    const [mapResult, setMapResult] = useState<'success' | 'error' | null>(null);

    // Counting state
    const [counting, setCounting]   = useState<CountingCfg>({ lineStart: null, lineEnd: null, insidePoint: null, crossingMargin: 10 });
    const [cntPick, setCntPick]     = useState<CountingPick>(null);
    const [cntSaving, setCntSaving] = useState(false);
    const [cntResult, setCntResult] = useState<'success' | 'error' | null>(null);

    // Shared selection
    const [sel, setSel] = useState<SelPt | null>(null);

    const nextId  = useRef(1);
    const camRef  = useRef<HTMLImageElement>(null);
    const fpRef   = useRef<HTMLImageElement>(null);
    const camZoom = useRef<ZoomHandle>(null);
    const fpZoom  = useRef<ZoomHandle>(null);
    const selRef  = useRef<SelPt | null>(null);
    useEffect(() => { selRef.current = sel; }, [sel]);

    // Pre-load existing configs from backend
    useEffect(() => {
        fetch(`${API_BASE}/api/lab_management/settings/mapping`)
            .then(r => r.json())
            .then((d: { image_size?: { width: number; height: number }; map_size?: { width: number; height: number }; correspondences?: { label: string; camera: number[]; map: number[] }[] }) => {
                if (!d.correspondences?.length) return;
                const iW = d.image_size?.width  || 1920, iH = d.image_size?.height || 1080;
                const mW = d.map_size?.width    || 1000, mH = d.map_size?.height   || 1000;
                setPairs(d.correspondences.map((c, i) => ({
                    id: i + 1,
                    camera: { x: c.camera[0] / iW, y: c.camera[1] / iH },
                    map:    { x: c.map[0]    / mW, y: c.map[1]    / mH },
                })));
                nextId.current = d.correspondences.length + 1;
            }).catch(() => {});

        fetch(`${API_BASE}/api/lab_management/settings/counting`)
            .then(r => r.json())
            .then((d: { line_start?: number[]; line_end?: number[]; inside_point?: number[]; crossing_margin?: number; frame_width?: number; frame_height?: number }) => {
                if (!d.line_start || !d.line_end) return;
                const fW = d.frame_width || 1920, fH = d.frame_height || 1080;
                setCounting({
                    lineStart:      { x: d.line_start[0]  / fW, y: d.line_start[1]  / fH },
                    lineEnd:        { x: d.line_end[0]    / fW, y: d.line_end[1]    / fH },
                    insidePoint:    d.inside_point ? { x: d.inside_point[0] / fW, y: d.inside_point[1] / fH } : null,
                    crossingMargin: d.crossing_margin ?? 10,
                });
            }).catch(() => {});
    }, []);

    // Body scroll lock + ESC
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selRef.current) setSel(null);
                else { setMapPick(null); setCntPick(null); onClose(); }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    }, [onClose]);

    // Arrow-key nudge
    useEffect(() => {
        if (!sel) return;
        const onKD = (e: KeyboardEvent) => {
            if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
            e.preventDefault();
            const step = e.shiftKey ? 5 : (e.ctrlKey || e.metaKey) ? 10 : 1;
            const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
            const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
            if (sel.scope === 'mapping') {
                const { pairId, side } = sel;
                const rW = side === 'camera' ? (camRef.current?.naturalWidth  || 1920) : (fpRef.current?.naturalWidth  || 1000);
                const rH = side === 'camera' ? (camRef.current?.naturalHeight || 1080) : (fpRef.current?.naturalHeight || 1000);
                setPairs(prev => prev.map(p =>
                    p.id !== pairId ? p : { ...p, [side]: { x: clamp(p[side].x + dx/rW), y: clamp(p[side].y + dy/rH) } }
                ));
            } else {
                const { pt } = sel;
                const rW = camRef.current?.naturalWidth  || 1920;
                const rH = camRef.current?.naturalHeight || 1080;
                setCounting(prev => {
                    const old = prev[pt]; if (!old) return prev;
                    return { ...prev, [pt]: { x: clamp(old.x + dx/rW), y: clamp(old.y + dy/rH) } };
                });
            }
        };
        window.addEventListener('keydown', onKD);
        return () => window.removeEventListener('keydown', onKD);
    }, [sel]);

    const switchMode = (m: ModeType) => {
        setMode(m); setMapPick(null); setCntPick(null); setSel(null);
    };

    // ── Mapping handlers ──────────────────────────────────────────────────────
    const startAddPair = () => {
        setSel(null); setMapResult(null);
        setMapPick({ side: 'camera', pendingCam: null });
    };

    const handleMapClick = useCallback((clickSide: 'camera' | 'map', x: number, y: number) => {
        if (!mapPick || mapPick.side !== clickSide) return;
        if (clickSide === 'camera') {
            setMapPick({ side: 'map', pendingCam: { x, y } });
        } else {
            if (!mapPick.pendingCam) return;
            setPairs(prev => [...prev, { id: nextId.current++, camera: mapPick.pendingCam!, map: { x, y } }]);
            setMapPick(null);
        }
    }, [mapPick]);

    const onCamMapClick = useCallback((x: number, y: number) => handleMapClick('camera', x, y), [handleMapClick]);
    const onFpMapClick  = useCallback((x: number, y: number) => handleMapClick('map', x, y),    [handleMapClick]);

    const removePair = (id: number) => {
        setPairs(p => p.filter(x => x.id !== id));
        if (sel?.scope === 'mapping' && sel.pairId === id) setSel(null);
    };

    const editMapPx = useCallback((id: number, side: 'camera' | 'map', axis: 'x' | 'y', px: number) => {
        const rW = side === 'camera' ? (camRef.current?.naturalWidth  || 1920) : (fpRef.current?.naturalWidth  || 1000);
        const rH = side === 'camera' ? (camRef.current?.naturalHeight || 1080) : (fpRef.current?.naturalHeight || 1000);
        setPairs(prev => prev.map(p => {
            if (p.id !== id) return p;
            return { ...p, [side]: { ...p[side], [axis]: px / (axis === 'x' ? rW : rH) } };
        }));
    }, []);

    const moveMapPoint = useCallback((pairId: number, side: 'camera' | 'map', norm: NormPt) => {
        setPairs(prev => prev.map(p => p.id !== pairId ? p : { ...p, [side]: norm }));
    }, []);

    const saveMapping = async () => {
        if (pairs.length < 1) return;
        const iW = camRef.current?.naturalWidth  || 1920, iH = camRef.current?.naturalHeight || 1080;
        const mW = fpRef.current?.naturalWidth   || 1000, mH = fpRef.current?.naturalHeight  || 1000;
        setMapSaving(true); setMapResult(null);
        try {
            const res = await fetch(`${API_BASE}/api/lab_management/settings/mapping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_size: { width: iW, height: iH },
                    map_size:   { width: mW, height: mH },
                    correspondences: pairs.map((p, i) => ({
                        label:  `p${i + 1}`,
                        camera: [round2(p.camera.x * iW), round2(p.camera.y * iH)],
                        map:    [round2(p.map.x    * mW), round2(p.map.y    * mH)],
                    })),
                }),
            });
            setMapResult(res.ok ? 'success' : 'error');
        } catch { setMapResult('error'); }
        finally   { setMapSaving(false); }
    };

    // ── Counting handlers ─────────────────────────────────────────────────────
    const handleCntDrag = useCallback((x1: number, y1: number, x2: number, y2: number) => {
        if (cntPick !== 'line') return;
        setCounting(prev => ({ ...prev, lineStart: { x: x1, y: y1 }, lineEnd: { x: x2, y: y2 } }));
        setCntPick('inside'); // auto-advance to inside point picking
    }, [cntPick]);

    const handleCntClick = useCallback((x: number, y: number) => {
        if (cntPick !== 'inside') return;
        setCounting(prev => ({ ...prev, insidePoint: { x, y } }));
        setCntPick(null);
    }, [cntPick]);

    const editCntPx = useCallback((pt: 'lineStart' | 'lineEnd' | 'insidePoint', axis: 'x' | 'y', px: number) => {
        const rW = camRef.current?.naturalWidth  || 1920;
        const rH = camRef.current?.naturalHeight || 1080;
        setCounting(prev => {
            const old = prev[pt]; if (!old) return prev;
            return { ...prev, [pt]: { ...old, [axis]: px / (axis === 'x' ? rW : rH) } };
        });
    }, []);

    const moveCntPoint = useCallback((pt: 'lineStart' | 'lineEnd' | 'insidePoint', norm: NormPt) => {
        setCounting(prev => ({ ...prev, [pt]: norm }));
    }, []);

    const moveCntLine = useCallback((delta: NormPt) => {
        setCounting(prev => {
            if (!prev.lineStart || !prev.lineEnd) return prev;
            return {
                ...prev,
                lineStart: { x: clamp(prev.lineStart.x + delta.x), y: clamp(prev.lineStart.y + delta.y) },
                lineEnd:   { x: clamp(prev.lineEnd.x + delta.x),   y: clamp(prev.lineEnd.y + delta.y) },
            };
        });
    }, []);

    const saveCounting = async () => {
        const { lineStart: s, lineEnd: e, insidePoint: ip, crossingMargin: cm } = counting;
        if (!s || !e || !ip) return;
        const fW = camRef.current?.naturalWidth  || 1920;
        const fH = camRef.current?.naturalHeight || 1080;
        setCntSaving(true); setCntResult(null);
        try {
            const res = await fetch(`${API_BASE}/api/lab_management/settings/counting`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_start:      [+(s.x  * fW).toFixed(4), +(s.y  * fH).toFixed(4)],
                    line_end:        [+(e.x  * fW).toFixed(4), +(e.y  * fH).toFixed(4)],
                    inside_point:    [+(ip.x * fW).toFixed(4), +(ip.y * fH).toFixed(4)],
                    crossing_margin: cm,
                    frame_width:     fW,
                    frame_height:    fH,
                }),
            });
            setCntResult(res.ok ? 'success' : 'error');
        } catch { setCntResult('error'); }
        finally   { setCntSaving(false); }
    };

    // ── Derived state ─────────────────────────────────────────────────────────
    const isMappingCamPicking = mode === 'mapping' && mapPick?.side === 'camera';
    const isMappingMapPicking = mode === 'mapping' && mapPick?.side === 'map';
    const isCntPicking        = mode === 'counting' && cntPick !== null;
    const isCntLinePicking    = mode === 'counting' && cntPick === 'line';

    const stepLabel = mode === 'mapping'
        ? (mapPick?.side === 'camera' ? 'Click a point on Camera Frame'
            : mapPick?.side === 'map' ? 'Click corresponding point on Floor Plan'
            : null)
        : (cntPick === 'line'   ? 'Drag to draw counting line'
            : cntPick === 'inside' ? 'Click to place "inside" point'
            : null);

    const selLabel = (() => {
        if (!sel) return null;
        if (sel.scope === 'mapping') {
            const i = pairs.findIndex(p => p.id === sel.pairId); if (i < 0) return null;
            const pt = sel.side === 'camera' ? pairs[i].camera : pairs[i].map;
            const rW = sel.side === 'camera' ? (camRef.current?.naturalWidth || 1920) : (fpRef.current?.naturalWidth || 1000);
            const rH = sel.side === 'camera' ? (camRef.current?.naturalHeight || 1080) : (fpRef.current?.naturalHeight || 1000);
            return `p${i+1} (${sel.side}) @ (${Math.round(pt.x*rW)}, ${Math.round(pt.y*rH)}) — ↑↓←→`;
        } else {
            const ptName = (sel as { scope: 'counting'; pt: string }).pt;
            const pt = counting[ptName as 'lineStart' | 'lineEnd' | 'insidePoint'];
            if (!pt) return null;
            const rW = camRef.current?.naturalWidth  || 1920;
            const rH = camRef.current?.naturalHeight || 1080;
            const labels: Record<string, string> = { lineStart: 'Line Start', lineEnd: 'Line End', insidePoint: 'Inside Point' };
            return `${labels[ptName]} @ (${Math.round(pt.x*rW)}, ${Math.round(pt.y*rH)}) — ↑↓←→`;
        }
    })();

    // Overlay factories
    const camMapOverlay  = (v: ViewState, cW: number, cH: number, clientToNorm: (cx: number, cy: number) => { x: number; y: number } | null) => (
        <MappingDotsOverlay pairs={pairs} mapPick={mapPick} sel={sel} onSelect={setSel}
            onMovePoint={moveMapPoint} clientToNorm={clientToNorm}
            side="camera" view={v} cW={cW} cH={cH} />
    );
    const fpMapOverlay   = (v: ViewState, cW: number, cH: number, clientToNorm: (cx: number, cy: number) => { x: number; y: number } | null) => (
        <MappingDotsOverlay pairs={pairs} mapPick={mapPick} sel={sel} onSelect={setSel}
            onMovePoint={moveMapPoint} clientToNorm={clientToNorm}
            side="map" view={v} cW={cW} cH={cH} />
    );
    const camCntOverlay  = (v: ViewState, cW: number, cH: number, clientToNorm: (cx: number, cy: number) => { x: number; y: number } | null) => (
        <CountingDotsOverlay counting={counting} sel={sel} onSelect={setSel}
            onMovePoint={moveCntPoint} onMoveLine={moveCntLine} clientToNorm={clientToNorm}
            cntPick={cntPick} view={v} cW={cW} cH={cH} />
    );

    const saving = mode === 'mapping' ? mapSaving : cntSaving;
    const result = mode === 'mapping' ? mapResult  : cntResult;
    const canSave = mode === 'mapping'
        ? (pairs.length >= 1 && !mapPick)
        : (!!(counting.lineStart && counting.lineEnd && counting.insidePoint));

    const handleSave = () => mode === 'mapping' ? saveMapping() : saveCounting();

    const modal = (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            style={{ zIndex: 9999 }} onClick={onClose}>
            <div className="bg-surface-1 border border-border-strong rounded-[var(--radius-xl)] shadow-2xl flex flex-col"
                style={{ width: 'calc(100vw - 3rem)', height: 'calc(100vh - 3rem)', zIndex: 10000 }}
                onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-border-default flex-wrap gap-y-2">
                    <span className="material-symbols-outlined text-accent shrink-0">map</span>

                    {/* Mode tabs */}
                    <div className="flex items-stretch gap-0 border border-border-default rounded-[var(--radius-md)] overflow-hidden shrink-0">
                        {([
                            { id: 'mapping'  as ModeType, icon: 'location_on', label: 'Mapping',  sub: 'Point pairs' },
                            { id: 'counting' as ModeType, icon: 'show_chart',  label: 'Counting', sub: 'Tripwire line' },
                        ] as const).map(tab => (
                            <button key={tab.id}
                                onClick={() => switchMode(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium transition-all
                                    ${mode === tab.id
                                        ? 'bg-accent text-white'
                                        : 'text-text-secondary hover:bg-surface-2'}`}>
                                <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                                <span>
                                    <span className="font-semibold">{tab.label}</span>
                                    <span className={`block text-[9px] ${mode === tab.id ? 'text-white/70' : 'text-text-tertiary'}`}>{tab.sub}</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Mode-specific tool buttons */}
                    {mode === 'mapping' && (
                        <button onClick={startAddPair} disabled={!!mapPick}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border transition-all
                                bg-surface-2 border-border-default text-text-secondary hover:border-accent hover:text-accent
                                disabled:opacity-40 disabled:cursor-not-allowed">
                            <span className="material-symbols-outlined text-sm">add_location</span>
                            + Add Point
                        </button>
                    )}
                    {mode === 'counting' && (
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => { setSel(null); setCntPick('line'); }}
                                disabled={cntPick !== null}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border transition-all
                                    disabled:opacity-40 disabled:cursor-not-allowed
                                    ${cntPick === 'line'
                                        ? 'bg-accent border-accent text-white'
                                        : 'bg-surface-2 border-border-default text-text-secondary hover:border-accent hover:text-accent'}`}>
                                <span className="material-symbols-outlined text-sm">show_chart</span>
                                Draw Line
                            </button>
                            <button onClick={() => { setSel(null); setCntPick('inside'); }}
                                disabled={cntPick !== null || !counting.lineStart}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border transition-all
                                    disabled:opacity-40 disabled:cursor-not-allowed
                                    ${cntPick === 'inside'
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'bg-surface-2 border-border-default text-text-secondary hover:border-emerald-500 hover:text-emerald-500'}`}>
                                <span className="material-symbols-outlined text-sm">my_location</span>
                                Inside Point
                            </button>
                        </div>
                    )}

                    {/* Step hint */}
                    {stepLabel && (
                        <div className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-[var(--radius-md)] px-3 py-1.5">
                            <span className="material-symbols-outlined text-accent text-sm animate-pulse">my_location</span>
                            <span className="text-xs text-accent font-medium">{stepLabel}</span>
                            <button onClick={() => { setMapPick(null); setCntPick(null); }}
                                className="ml-1 text-[10px] text-accent/70 hover:text-accent underline underline-offset-2">
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Selection hint */}
                    {selLabel && !mapPick && !cntPick && (
                        <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-[var(--radius-md)] px-3 py-1.5">
                            <span className="material-symbols-outlined text-warning text-sm">open_with</span>
                            <span className="text-xs text-warning font-medium font-mono">{selLabel}</span>
                            <button onClick={() => setSel(null)}
                                className="ml-1 text-[10px] text-warning/70 hover:text-warning underline underline-offset-2">
                                Deselect
                            </button>
                        </div>
                    )}

                    {/* Right controls */}
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                        {mode === 'mapping' && (
                            <>
                                <span className={`text-xs font-mono px-2.5 py-1 rounded-full border
                                    ${pairs.length >= 4 ? 'border-success/40 text-success bg-success/10' : 'border-border-subtle text-text-tertiary'}`}>
                                    {pairs.length} pair{pairs.length !== 1 ? 's' : ''}
                                    {pairs.length < 4 && ` / 4 min`}
                                </span>
                                <button onClick={() => { setPairs([]); setMapPick(null); setSel(null); setMapResult(null); }}
                                    disabled={pairs.length === 0 && !mapPick}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-border-default text-xs text-text-secondary hover:border-danger hover:text-danger disabled:opacity-40 transition-all">
                                    <span className="material-symbols-outlined text-sm">delete_sweep</span>
                                    Clear
                                </button>
                            </>
                        )}
                        <div className="w-px h-5 bg-border-subtle" />
                        <button onClick={handleSave} disabled={!canSave || saving}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius-md)] bg-success text-white text-xs font-medium hover:bg-success/90 disabled:opacity-40 transition-all">
                            <span className={`material-symbols-outlined text-sm ${saving ? 'animate-spin' : ''}`}>
                                {saving ? 'progress_activity' : 'save'}
                            </span>
                            {saving ? 'Saving…' : `Apply ${mode === 'mapping' ? 'Mapping' : 'Counting'}`}
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
                    <div className={`shrink-0 flex items-center gap-2 px-5 py-2 text-xs border-b
                        ${result === 'success' ? 'bg-success/10 border-success/20 text-success' : 'bg-danger/10 border-danger/20 text-danger'}`}>
                        <span className="material-symbols-outlined text-sm">{result === 'success' ? 'check_circle' : 'error'}</span>
                        {result === 'success'
                            ? `${mode === 'mapping' ? 'Mapping' : 'Counting'} config saved. Backend will apply the new settings.`
                            : 'Failed to save. Check backend connection.'}
                    </div>
                )}

                {/* ── Body ── */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 min-w-0 p-4 flex flex-col gap-3 min-h-0">

                        {/* ── Mapping mode ── */}
                        {mode === 'mapping' && (
                            <>
                                <p className="shrink-0 text-[11px] text-text-tertiary">
                                    <span className="text-accent font-medium">Scroll / ±</span> zoom ·
                                    <span className="text-accent font-medium ml-1">Drag</span> pan ·
                                    <span className="text-accent font-medium ml-1">Click dot</span> → ↑↓←→ ·
                                    <span className="text-accent font-medium ml-1">Hover 0.5s or hold 0.3s</span> → drag to move
                                </p>
                                <div className="flex gap-4 flex-1 min-h-0">
                                    <ZoomableCanvas ref={camZoom} label="Camera Frame"
                                        labelExtra={wsStatus !== 'connected' && <span className="text-warning normal-case font-normal ml-1">(no stream)</span>}
                                        isPicking={isMappingCamPicking} isDragTool={false}
                                        activeTool="point"
                                        onNormClick={onCamMapClick}
                                        onNormDragEnd={() => {}}
                                        onCanvasClick={() => setSel(null)}
                                        overlay={camMapOverlay}>
                                        {currentFrame
                                            ? <img ref={camRef} src={currentFrame} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain bg-black" />
                                            : <div className="absolute inset-0 bg-surface-0 flex flex-col items-center justify-center gap-2">
                                                <span className="material-symbols-outlined text-5xl text-text-tertiary">videocam_off</span>
                                                <p className="text-xs text-text-tertiary">No live frame</p>
                                              </div>
                                        }
                                    </ZoomableCanvas>

                                    <ZoomableCanvas ref={fpZoom} label="Floor Plan (Map)"
                                        isPicking={isMappingMapPicking} isDragTool={false}
                                        activeTool="point"
                                        onNormClick={onFpMapClick}
                                        onNormDragEnd={() => {}}
                                        onCanvasClick={() => setSel(null)}
                                        overlay={fpMapOverlay}>
                                        <img ref={fpRef} src="/labmap.svg" alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain bg-surface-0" />
                                    </ZoomableCanvas>
                                </div>
                            </>
                        )}

                        {/* ── Counting mode ── */}
                        {mode === 'counting' && (
                            <>
                                <p className="shrink-0 text-[11px] text-text-tertiary">
                                    <span className="text-accent font-medium">Draw Line:</span> drag to set tripwire ·
                                    <span className="text-accent font-medium ml-1">Inside Point:</span> click the "entry" side ·
                                    <span className="text-accent font-medium ml-1">Click dot</span> → ↑↓←→ ·
                                    <span className="text-accent font-medium ml-1">Hover 0.5s or hold 0.3s</span> → drag point/line
                                </p>
                                <ZoomableCanvas ref={camZoom} label="Camera Frame"
                                    labelExtra={wsStatus !== 'connected' && <span className="text-warning normal-case font-normal ml-1">(no stream)</span>}
                                    isPicking={isCntPicking} isDragTool={isCntLinePicking}
                                    activeTool={cntPick === 'line' ? 'line' : 'point'}
                                    onNormClick={handleCntClick}
                                    onNormDragEnd={handleCntDrag}
                                    onCanvasClick={() => setSel(null)}
                                    overlay={camCntOverlay}>
                                    {currentFrame
                                        ? <img ref={camRef} src={currentFrame} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain bg-black" />
                                        : <div className="absolute inset-0 bg-surface-0 flex flex-col items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-5xl text-text-tertiary">videocam_off</span>
                                            <p className="text-xs text-text-tertiary">No live frame</p>
                                          </div>
                                    }
                                    <CountingShapeLayer counting={counting} />
                                </ZoomableCanvas>
                            </>
                        )}
                    </div>

                    {/* ── Sidebar (mode-specific) ── */}
                    {mode === 'mapping' && (
                        <MappingSidebar pairs={pairs} mapPick={mapPick} sel={sel}
                            onRemove={removePair} onEditPx={editMapPx}
                            camRef={camRef} fpRef={fpRef} />
                    )}
                    {mode === 'counting' && (
                        <CountingSidebar counting={counting} sel={sel} cntPick={cntPick}
                            setCounting={setCounting} onEditPx={editCntPx} camRef={camRef} />
                    )}
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
                        <p className="text-sm font-medium text-text-primary">Calibration Setup</p>
                        <p className="text-xs text-text-tertiary mt-1 leading-relaxed max-w-md">
                            Configure <span className="text-text-secondary font-medium">Mapping Service</span> (camera↔floor plan point pairs)
                            and <span className="text-text-secondary font-medium">Counting Service</span> (virtual tripwire line) independently.
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
