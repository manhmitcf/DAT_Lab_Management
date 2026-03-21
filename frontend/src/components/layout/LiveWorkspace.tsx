'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FloorPlan from '@/components/panels/FloorPlan';
import VideoPlayer from '@/components/video/VideoPlayer';

const MIN_MAP = 260;
const MIN_VIDEO = 280;
const HANDLE_W = 10;

function useIsLg() {
    const [isLg, setIsLg] = useState(false);
    useEffect(() => {
        const m = window.matchMedia('(min-width: 1024px)');
        setIsLg(m.matches);
        const h = () => setIsLg(m.matches);
        m.addEventListener('change', h);
        return () => m.removeEventListener('change', h);
    }, []);
    return isLg;
}

export default function LiveWorkspace() {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startX: number; startMapW: number } | null>(null);
    const [mapWidth, setMapWidth] = useState(400);
    const isLg = useIsLg();

    const onPointerMove = useCallback((e: PointerEvent) => {
        const drag = dragRef.current;
        const el = containerRef.current;
        if (!drag || !el) return;
        const rect = el.getBoundingClientRect();
        const maxMap = Math.max(MIN_MAP, rect.width * 0.62 - HANDLE_W);
        const delta = e.clientX - drag.startX;
        const next = Math.min(maxMap, Math.max(MIN_MAP, drag.startMapW - delta));
        const maxAllowed = rect.width - MIN_VIDEO - HANDLE_W;
        setMapWidth(Math.min(next, maxAllowed));
    }, []);

    const endDrag = useCallback(() => {
        dragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', endDrag);
        window.removeEventListener('pointercancel', endDrag);
    }, [onPointerMove]);

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            e.preventDefault();
            dragRef.current = { startX: e.clientX, startMapW: mapWidth };
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', endDrag);
            window.addEventListener('pointercancel', endDrag);
            e.currentTarget.setPointerCapture(e.pointerId);
        },
        [mapWidth, onPointerMove, endDrag]
    );

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            const w = el.getBoundingClientRect().width;
            const maxAllowed = w - MIN_VIDEO - HANDLE_W;
            setMapWidth((mw) => Math.min(Math.max(mw, MIN_MAP), Math.max(MIN_MAP, maxAllowed)));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <div
            ref={containerRef}
            className="flex flex-1 min-h-0 w-full flex-col lg:flex-row bg-[#0b0e11]"
        >
            <section className="min-h-0 min-w-0 flex flex-1 flex-col flex-[2] lg:flex-[1]" style={{ minWidth: MIN_VIDEO, minHeight: 200 }}>
                <VideoPlayer />
            </section>

            <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize camera and map panels"
                onPointerDown={onPointerDown}
                className="hidden lg:flex group relative z-20 w-2.5 shrink-0 cursor-col-resize items-center justify-center bg-[#0b0e11] hover:bg-[#1a222c]"
            >
                <span className="h-16 w-1 rounded-full bg-[#3d4b5c] transition-colors group-hover:bg-[#137fec]/80 group-active:bg-[#137fec]" />
            </div>

            <section
                className="flex min-h-[200px] min-w-0 lg:min-h-0 flex-col overflow-hidden bg-[#0b0e11]"
                style={isLg ? { width: mapWidth, maxWidth: '62%', flex: 'none' } : { flex: 1 }}
            >
                <FloorPlan />
            </section>
        </div>
    );
}
