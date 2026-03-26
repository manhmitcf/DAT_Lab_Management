'use client';

import Link from 'next/link';
import LiveWorkspace from '@/components/layout/LiveWorkspace';
import MainSidebar, { SidebarHamburger } from '@/components/layout/MainSidebar';
import MiniOccupancyChart from '@/components/panels/MiniOccupancyChart';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getAlertLevelDisplay } from '@/lib/alertLabels';
import { useTrackingStore } from '@/stores/trackingStore';

export default function LiveViewPage() {
  useWebSocket();

  const stats = useTrackingStore((s) => s.stats);
  const alertLevel = useTrackingStore((s) => s.alertLevel);
  const alertUi = getAlertLevelDisplay(alertLevel);

  return (
    <div className="flex h-screen w-full min-h-0 bg-[#101922] text-white">
      <MainSidebar />

      <div className="flex min-w-0 flex-1 flex-col min-h-0 overflow-hidden">
        <header className="z-50 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4 border-b border-[#2a3441] bg-[#1B2431] px-3 py-2.5 sm:px-5 sm:py-3">
          <SidebarHamburger />
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded bg-[#137fec]/20 text-[#137fec]">
              <span className="material-symbols-outlined text-lg">visibility</span>
            </div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight">Live</h1>
          </div>
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <span className="material-symbols-outlined text-base text-emerald-400 shrink-0">groups</span>
            <span className="text-xs text-gray-500 uppercase whitespace-nowrap">Occupancy</span>
            <span className="text-sm font-semibold tabular-nums text-white font-mono">{stats.person_count}</span>
          </div>
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <span className="material-symbols-outlined text-base text-sky-400 shrink-0">swap_horiz</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">Entry/Exit</span>
            <span className="text-sm font-semibold tabular-nums font-mono">
              <span className="text-emerald-400">{stats.entry_today}</span>
              <span className="mx-0.5 text-gray-500">/</span>
              <span className="text-orange-400">{stats.exit_today}</span>
            </span>
          </div>
          <div className="hidden sm:block h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <div className="hidden sm:flex items-center gap-2 shrink-0 min-w-0">
            <span className="material-symbols-outlined text-base text-violet-400 shrink-0">speed</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">FPS</span>
            <span className="text-sm font-semibold tabular-nums text-white font-mono">{stats.fps}</span>
          </div>
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <Link
            href="/alerts"
            title={alertUi.description}
            className="flex items-center gap-2 shrink-0 min-w-0 rounded-md px-1 py-0.5 -mx-1 text-white/90 hover:bg-white/5 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-base text-amber-400 shrink-0">warning</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">Alert</span>
            <span className={`text-sm font-semibold tabular-nums ${alertUi.textClass}`}>{alertUi.short}</span>
          </Link>
          <div className="flex-1 min-w-[0.5rem] hidden md:block" aria-hidden />
          <div className="hidden md:block h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <div className="hidden md:block shrink-0 pl-1">
            <MiniOccupancyChart />
          </div>
        </header>

        <LiveWorkspace />
      </div>
    </div>
  );
}
