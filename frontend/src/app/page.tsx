'use client';

import Link from 'next/link';
import LiveWorkspace from '@/components/layout/LiveWorkspace';
import MainSidebar, { SidebarHamburger } from '@/components/layout/MainSidebar';
import MiniOccupancyChart from '@/components/panels/MiniOccupancyChart';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTrackingStore } from '@/stores/trackingStore';

export default function LiveViewPage() {
  useWebSocket();

  const stats = useTrackingStore((s) => s.stats);
  const alertLevel = useTrackingStore((s) => s.alertLevel);

  return (
    <div className="flex h-screen w-full min-h-0 bg-[#101922] text-white">
      <MainSidebar />

      <div className="flex min-w-0 flex-1 flex-col min-h-0 overflow-hidden">
        <header className="z-50 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#2a3441] bg-[#1B2431] px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">
            <SidebarHamburger />
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#137fec]/20 text-[#137fec]">
                <span className="material-symbols-outlined text-xl">visibility</span>
              </div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight">Live</h1>
            </div>

            <div className="hidden h-8 w-px shrink-0 bg-[#2a3441] sm:block" />

            <div className="flex flex-wrap items-stretch gap-1.5 sm:gap-3">
              <div className="flex min-w-[4.5rem] sm:min-w-[5.5rem] items-center gap-1.5 sm:gap-2 rounded-lg bg-[#283039]/70 px-2 sm:px-2.5 py-1.5">
                <span className="material-symbols-outlined shrink-0 text-lg text-emerald-400">groups</span>
                <div>
                  <p className="text-[9px] font-medium uppercase leading-none tracking-wide text-gray-500">
                    Occupancy
                  </p>
                  <p className="text-sm font-semibold tabular-nums leading-tight text-white font-mono">
                    {stats.person_count}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-[#283039]/70 px-2 sm:px-2.5 py-1.5">
                <span className="material-symbols-outlined shrink-0 text-lg text-sky-400">swap_horiz</span>
                <div>
                  <p className="text-[9px] font-medium uppercase leading-none tracking-wide text-gray-500">
                    Entry / Exit
                  </p>
                  <p className="text-sm font-semibold tabular-nums leading-tight font-mono">
                    <span className="text-emerald-400">{stats.entry_today}</span>
                    <span className="mx-1 text-gray-500">/</span>
                    <span className="text-orange-400">{stats.exit_today}</span>
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex min-w-[6.5rem] items-center gap-2 rounded-lg bg-[#283039]/70 px-2.5 py-1.5">
                <span className="material-symbols-outlined shrink-0 text-lg text-violet-400">speed</span>
                <div>
                  <p className="text-[9px] font-medium uppercase leading-none tracking-wide text-gray-500">
                    Frames per second
                  </p>
                  <p className="text-sm font-semibold tabular-nums leading-tight text-white font-mono">{stats.fps}</p>
                </div>
              </div>

              <Link
                href="/alerts"
                className="flex min-w-[4.5rem] sm:min-w-[5.5rem] items-center gap-1.5 sm:gap-2 rounded-lg bg-[#283039]/70 px-2 sm:px-2.5 py-1.5 transition-colors hover:bg-[#343f4d]"
              >
                <span className="material-symbols-outlined shrink-0 text-lg text-amber-400">warning</span>
                <div>
                  <p className="text-[9px] font-medium uppercase leading-none tracking-wide text-gray-500">
                    Alert level
                  </p>
                  <p className="text-sm font-semibold uppercase leading-tight text-amber-300 font-mono">{alertLevel}</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="hidden md:block shrink-0"><MiniOccupancyChart /></div>
        </header>

        <LiveWorkspace />
      </div>
    </div>
  );
}
