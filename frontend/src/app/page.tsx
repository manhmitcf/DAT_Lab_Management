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
        <header className="z-50 flex min-h-[3.25rem] shrink-0 flex-wrap items-center gap-x-5 gap-y-3 border-b border-[#2a3441] bg-[#1B2431] px-4 py-3 sm:gap-x-6 sm:px-6 md:gap-x-8 md:px-8 sm:py-3.5 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
          <SidebarHamburger />
          <div className="mx-0.5 h-6 w-px shrink-0 bg-[#2a3441] sm:mx-1.5" aria-hidden />
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 rounded-md px-1.5 py-0.5 sm:px-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded bg-[#137fec]/20 text-[#137fec]">
              <span className="material-symbols-outlined text-lg">visibility</span>
            </div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight">Live</h1>
          </div>
          <div className="mx-0.5 h-6 w-px shrink-0 bg-[#2a3441] sm:mx-1.5" aria-hidden />
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 rounded-md px-1.5 py-0.5 sm:px-2.5">
            <span className="material-symbols-outlined text-base text-emerald-400 shrink-0">groups</span>
            <span className="text-xs text-gray-500 uppercase whitespace-nowrap">Occupancy</span>
            <span className="text-sm font-semibold tabular-nums text-white font-mono">{stats.person_count}</span>
          </div>
          <div className="mx-0.5 h-6 w-px shrink-0 bg-[#2a3441] sm:mx-1.5" aria-hidden />
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 rounded-md px-1.5 py-0.5 sm:px-2.5">
            <span className="material-symbols-outlined text-base text-sky-400 shrink-0">swap_horiz</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">Entry/Exit</span>
            <span className="text-sm font-semibold tabular-nums font-mono">
              <span className="text-emerald-400">{stats.entry_today}</span>
              <span className="mx-1 text-gray-500">/</span>
              <span className="text-orange-400">{stats.exit_today}</span>
            </span>
          </div>
          <div className="mx-0.5 hidden h-6 w-px shrink-0 bg-[#2a3441] sm:mx-1.5 sm:block" aria-hidden />
          <div className="hidden sm:flex items-center gap-2.5 sm:gap-3 shrink-0 rounded-md px-1.5 py-0.5 sm:px-2.5">
            <span className="material-symbols-outlined text-base text-violet-400 shrink-0">speed</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">FPS</span>
            <span className="text-sm font-semibold tabular-nums text-white font-mono">{stats.fps}</span>
          </div>
          <div className="mx-0.5 h-6 w-px shrink-0 bg-[#2a3441] sm:mx-1.5" aria-hidden />
          <Link
            href="/alerts"
            title={alertUi.description}
            className="flex items-center gap-2.5 sm:gap-3 shrink-0 rounded-md px-2 py-1 sm:px-2.5 text-white/90 hover:bg-white/5 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-base text-amber-400 shrink-0">warning</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">Alert</span>
            <span className={`text-sm font-semibold tabular-nums ${alertUi.textClass}`}>{alertUi.short}</span>
          </Link>
          <div className="min-w-[0.5rem] flex-1 basis-4 hidden md:block" aria-hidden />
          <div className="mx-0.5 hidden h-6 w-px shrink-0 bg-[#2a3441] md:mx-1.5 md:block" aria-hidden />
          <div className="hidden shrink-0 md:block md:pl-2">
            <MiniOccupancyChart />
          </div>
        </header>

        <LiveWorkspace />
      </div>
    </div>
  );
}
