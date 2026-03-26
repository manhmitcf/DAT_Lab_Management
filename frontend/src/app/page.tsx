'use client';

import Link from 'next/link';
import LiveWorkspace from '@/components/layout/LiveWorkspace';
import MainSidebar, { SidebarHamburger } from '@/components/layout/MainSidebar';
import MiniOccupancyChart from '@/components/panels/MiniOccupancyChart';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getAlertLevelDisplay } from '@/lib/alertLabels';
import { formatDisplayInt } from '@/lib/formatDisplayInt';
import { useTrackingStore } from '@/stores/trackingStore';

function statDisplayText(value: number | string): string {
  if (typeof value === 'number') return formatDisplayInt(value);
  const t = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return formatDisplayInt(t);
  return value;
}

/** Caps numeric width so BE outliers do not expand the Live header; full value in title. */
function StatNumber({
  value,
  maxCh = 12,
  className = '',
}: {
  value: number | string;
  maxCh?: number;
  className?: string;
}) {
  const raw = typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value).trim())
    ? String(typeof value === 'number' ? value : Number(String(value).replace(/,/g, '')))
    : String(value);
  const s = statDisplayText(value);
  return (
    <span
      className={`min-w-0 truncate text-right tabular-nums font-mono text-sm font-semibold ${className}`}
      style={{ maxWidth: `${maxCh}ch` }}
      title={Number.isFinite(Number(raw)) ? raw : s}
    >
      {s}
    </span>
  );
}

export default function LiveViewPage() {
  useWebSocket();

  const stats = useTrackingStore((s) => s.stats);
  const alertLevel = useTrackingStore((s) => s.alertLevel);
  const alertUi = getAlertLevelDisplay(alertLevel);

  return (
    <div className="flex h-screen w-full min-h-0 bg-[#101922] text-white">
      <MainSidebar />

      <div className="flex min-w-0 flex-1 flex-col min-h-0 overflow-hidden">
        <header className="z-50 flex min-h-11 shrink-0 flex-nowrap items-center gap-x-3 border-b border-[#2a3441] bg-[#1B2431] px-3 py-2 sm:gap-x-4 sm:px-4 sm:py-2.5 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
          <SidebarHamburger />
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 rounded-md py-0.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded bg-[#137fec]/20 text-[#137fec]">
              <span className="material-symbols-outlined text-lg">visibility</span>
            </div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight">Live</h1>
          </div>
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 rounded-md py-0.5">
            <span className="material-symbols-outlined text-base text-emerald-400 shrink-0">groups</span>
            <span className="text-xs text-gray-500 uppercase whitespace-nowrap">Occupancy</span>
            <StatNumber value={stats.person_count} maxCh={12} className="text-white" />
          </div>
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 rounded-md py-0.5">
            <span className="material-symbols-outlined text-base text-sky-400 shrink-0">swap_horiz</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">Entry/Exit</span>
            <span
              className="flex min-w-0 max-w-[min(26ch,42vw)] items-baseline justify-end gap-0.5 font-mono text-sm font-semibold tabular-nums"
              title={`${stats.entry_today} / ${stats.exit_today}`}
            >
              <span className="min-w-0 max-w-[12ch] truncate text-right text-emerald-400">
                {formatDisplayInt(stats.entry_today)}
              </span>
              <span className="shrink-0 text-gray-500">/</span>
              <span className="min-w-0 max-w-[12ch] truncate text-right text-orange-400">
                {formatDisplayInt(stats.exit_today)}
              </span>
            </span>
          </div>
          <div className="hidden h-6 w-px shrink-0 bg-[#2a3441] sm:block" aria-hidden />
          <div className="hidden sm:flex items-center gap-2 sm:gap-2.5 shrink-0 rounded-md py-0.5">
            <span className="material-symbols-outlined text-base text-violet-400 shrink-0">speed</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">FPS</span>
            <StatNumber value={stats.fps} maxCh={8} className="text-white" />
          </div>
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <Link
            href="/alerts"
            title={alertUi.description}
            className="flex items-center gap-2 sm:gap-2.5 shrink-0 rounded-md py-0.5 text-white/90 hover:bg-white/5 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-base text-amber-400 shrink-0">warning</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">Alert</span>
            <span
              className={`min-w-0 max-w-[14ch] truncate text-right text-sm font-semibold tabular-nums ${alertUi.textClass}`}
              title={alertUi.short}
            >
              {alertUi.short}
            </span>
          </Link>
          <div className="min-w-[0.5rem] flex-1 basis-4 hidden md:block" aria-hidden />
          <div className="hidden h-6 w-px shrink-0 bg-[#2a3441] md:block" aria-hidden />
          <div className="hidden max-w-[min(400px,50vw)] shrink-0 overflow-hidden md:block">
            <MiniOccupancyChart />
          </div>
        </header>

        <LiveWorkspace />
      </div>
    </div>
  );
}
