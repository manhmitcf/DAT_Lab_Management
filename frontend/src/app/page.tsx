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
        <header className="z-50 flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-[#2a3441] bg-[#1B2431] py-2.5 pl-0 pr-3.5 sm:gap-x-5 sm:py-3 sm:pr-5 md:gap-x-6 md:pr-6 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
          <SidebarHamburger />
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 rounded-md py-0.5 pl-0 pr-2 sm:pr-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded bg-[#137fec]/20 text-[#137fec]">
              <span className="material-symbols-outlined text-lg">visibility</span>
            </div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight">Live</h1>
          </div>
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 rounded-md py-0.5 pl-0 pr-2 sm:pr-2">
            <span className="material-symbols-outlined text-base text-emerald-400 shrink-0">groups</span>
            <span className="text-xs text-gray-500 uppercase whitespace-nowrap">Occupancy</span>
            <span className="text-sm font-semibold tabular-nums text-white font-mono">{stats.person_count}</span>
          </div>
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 rounded-md py-0.5 pl-0 pr-2 sm:pr-2">
            <span className="material-symbols-outlined text-base text-sky-400 shrink-0">swap_horiz</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">Entry/Exit</span>
            <span className="text-sm font-semibold tabular-nums font-mono">
              <span className="text-emerald-400">{stats.entry_today}</span>
              <span className="ml-0 mr-0.5 text-gray-500">/</span>
              <span className="text-orange-400">{stats.exit_today}</span>
            </span>
          </div>
          <div className="hidden h-6 w-px shrink-0 bg-[#2a3441] sm:block" aria-hidden />
          <div className="hidden sm:flex items-center gap-2 sm:gap-2.5 shrink-0 rounded-md py-0.5 pl-0 pr-2 sm:pr-2">
            <span className="material-symbols-outlined text-base text-violet-400 shrink-0">speed</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">FPS</span>
            <span className="text-sm font-semibold tabular-nums text-white font-mono">{stats.fps}</span>
          </div>
          <div className="h-6 w-px shrink-0 bg-[#2a3441]" aria-hidden />
          <Link
            href="/alerts"
            title={alertUi.description}
            className="flex items-center gap-2 sm:gap-2.5 shrink-0 rounded-md py-0.5 pl-0 pr-2 sm:pr-2 text-white/90 hover:bg-white/5 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-base text-amber-400 shrink-0">warning</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">Alert</span>
            <span className={`text-sm font-semibold tabular-nums ${alertUi.textClass}`}>{alertUi.short}</span>
          </Link>
          <div className="min-w-[0.5rem] flex-1 basis-4 hidden md:block" aria-hidden />
          <div className="hidden h-6 w-px shrink-0 bg-[#2a3441] md:block" aria-hidden />
          <div className="hidden shrink-0 pl-0 pr-0 md:block md:pr-2">
            <MiniOccupancyChart />
          </div>
        </header>

        <LiveWorkspace />
      </div>
    </div>
  );
}
