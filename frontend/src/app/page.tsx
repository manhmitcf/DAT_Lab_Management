'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import StatsBar from '@/components/panels/StatsBar';
import CameraGrid from '@/components/video/CameraGrid';
import FloorPlan from '@/components/panels/FloorPlan';
import Badge from '@/components/ui/Badge';

export default function LiveMonitorPage() {
  const [asideWidth, setAsideWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = containerRect.right - e.clientX;

        // Constraints
        if (newWidth > 200 && newWidth < 800) {
          setAsideWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <div className="flex h-screen w-full bg-surface-0 overflow-hidden" ref={containerRef}>
      <MainSidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* ===== HEADER ===== */}
        <header className="shrink-0 bg-surface-1 border-b border-border-default animate-fade-in z-10">
          {/* Row 1: Stats strip */}
          <StatsBar />

          {/* Row 2: Live Feed label + Detection Activity */}
          <div className="flex items-stretch border-t border-border-subtle">
            <div className="flex items-center gap-3 px-5 py-2.5 border-r border-border-subtle shrink-0">
              <h2 className="text-text-primary text-sm font-semibold tracking-tight">Live Feed</h2>
              <Badge variant="success" pulse>
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Live
              </Badge>
            </div>

            <div className="flex items-center gap-3 px-5 py-2.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <span className="material-symbols-outlined text-accent text-sm">show_chart</span>
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Activity</span>
              </div>
              <div className="flex-1 h-8 min-w-0">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 200 32">
                  <defs>
                    <linearGradient id="headerChartGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 28 L20 24 L40 26 L60 20 L80 14 L100 16 L120 8 L140 10 L160 5 L180 12 L200 8 V 32 H 0 Z" fill="url(#headerChartGrad)" />
                  <path d="M0 28 L20 24 L40 26 L60 20 L80 14 L100 16 L120 8 L140 10 L160 5 L180 12 L200 8" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </header>

        {/* ===== CONTENT: Resizable Split ===== */}
        <div className={`flex-1 flex overflow-hidden animate-fade-in ${isResizing ? 'select-none' : ''}`}>
          {/* Main Content (Video) */}
          <main className="flex-1 relative overflow-hidden bg-black">
            <div className="absolute inset-0 p-3">
              <CameraGrid layout={1} />
            </div>
          </main>

          {/* Resize Handle */}
          <div
            onMouseDown={startResizing}
            className={`w-1.5 shrink-0 cursor-col-resize transition-colors z-20 hover:bg-accent/40 ${isResizing ? 'bg-accent/60' : 'bg-transparent'}`}
          >
            <div className="h-full w-px bg-border-default mx-auto" />
          </div>

          {/* 2D Floor Plan Sidebar */}
          <aside
            style={{ width: asideWidth }}
            className="shrink-0 bg-surface-1 overflow-hidden flex flex-col relative z-10 border-l border-border-default"
          >
            <FloorPlan />
          </aside>
        </div>
      </div>
    </div>
  );
}
