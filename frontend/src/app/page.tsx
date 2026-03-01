'use client';

import MainSidebar from '@/components/layout/MainSidebar';
import StatsBar from '@/components/panels/StatsBar';
import CameraGrid from '@/components/video/CameraGrid';
import FloorPlan from '@/components/panels/FloorPlan';
import Badge from '@/components/ui/Badge';

export default function LiveMonitorPage() {
  return (
    <div className="flex h-screen w-full bg-surface-0">
      <MainSidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* ===== HEADER ===== */}
        <header className="shrink-0 bg-surface-1 border-b border-border-default animate-fade-in">
          {/* Row 1: Stats strip (enlarged) */}
          <StatsBar />

          {/* Row 2: Live Feed label + Detection Activity sparkline */}
          <div className="flex items-stretch border-t border-border-subtle">
            {/* Live Feed label */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-r border-border-subtle shrink-0">
              <h2 className="text-text-primary text-sm font-semibold">Live Feed</h2>
              <Badge variant="success" pulse>
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Live
              </Badge>
            </div>

            {/* Detection Activity sparkline — fills remaining space */}
            <div className="flex items-center gap-3 px-5 py-2.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <span className="material-symbols-outlined text-accent text-sm">show_chart</span>
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Activity</span>
                <span className="text-[10px] text-text-tertiary font-mono">24h</span>
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

        {/* ===== CONTENT: Single Camera + 2D Map ===== */}
        <div className="flex-1 flex overflow-hidden animate-fade-in">
          {/* Single camera view */}
          <main className="flex-1 p-3 overflow-hidden">
            <CameraGrid layout={1} />
          </main>

          {/* 2D Floor Plan */}
          <aside className="w-[340px] shrink-0 border-l border-border-default bg-surface-1 p-3 overflow-hidden flex flex-col animate-slide-in">
            <FloorPlan />
          </aside>
        </div>
      </div>
    </div>
  );
}
