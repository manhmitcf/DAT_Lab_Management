'use client';

import Link from 'next/link';
import MainSidebar from '@/components/layout/MainSidebar';
import FloorPlan from '@/components/panels/FloorPlan';
import VideoPlayer from '@/components/video/VideoPlayer';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTrackingStore } from '@/stores/trackingStore';

function WsStatusDot() {
  const wsStatus = useTrackingStore((s) => s.wsStatus);
  const color =
    wsStatus === 'connected'
      ? 'bg-emerald-500'
      : wsStatus === 'connecting'
        ? 'bg-amber-400 animate-pulse'
        : wsStatus === 'error'
          ? 'bg-red-500'
          : 'bg-gray-500';
  const label =
    wsStatus === 'connected'
      ? 'WS live'
      : wsStatus === 'connecting'
        ? 'WS …'
        : wsStatus === 'error'
          ? 'WS error'
          : 'WS off';
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#283039]/60" title={label}>
      <span className={`size-2 rounded-full shrink-0 ${color}`} />
      <span className="text-[10px] font-mono text-gray-400 hidden xl:inline">{label}</span>
    </div>
  );
}

export default function LiveViewPage() {
  useWebSocket();

  const stats = useTrackingStore((s) => s.stats);
  const alertLevel = useTrackingStore((s) => s.alertLevel);

  return (
    <div className="flex h-screen w-full min-h-0 bg-[#101922] text-white">
      <MainSidebar />

      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {/* Single top bar: brand + all live metrics */}
        <header className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#2a3441] bg-[#1B2431] px-4 py-2.5 z-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-8 flex items-center justify-center bg-[#137fec]/20 text-[#137fec] rounded-lg shrink-0">
              <span className="material-symbols-outlined text-xl">visibility</span>
            </div>
            <h1 className="text-base font-bold tracking-tight truncate">Live</h1>
            <WsStatusDot />
          </div>

          <div className="hidden sm:block h-8 w-px bg-[#2a3441] shrink-0" />

          <div className="flex flex-wrap items-stretch gap-2 sm:gap-3 flex-1 justify-start lg:justify-end">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#283039]/70 min-w-[4.5rem]">
              <span className="material-symbols-outlined text-emerald-400 text-lg shrink-0">groups</span>
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide leading-none">Occu</p>
                <p className="text-sm font-mono font-semibold text-white leading-tight tabular-nums">
                  {stats.person_count}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#283039]/70">
              <span className="material-symbols-outlined text-sky-400 text-lg shrink-0">swap_horiz</span>
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide leading-none">In / Out</p>
                <p className="text-sm font-mono font-semibold leading-tight tabular-nums">
                  <span className="text-emerald-400">{stats.entry_today}</span>
                  <span className="text-gray-500 mx-0.5">/</span>
                  <span className="text-orange-400">{stats.exit_today}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#283039]/70 min-w-[3.5rem]">
              <span className="material-symbols-outlined text-violet-400 text-lg shrink-0">speed</span>
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide leading-none">FPS</p>
                <p className="text-sm font-mono font-semibold text-white leading-tight tabular-nums">{stats.fps}</p>
              </div>
            </div>

            <Link
              href="/alerts"
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#283039]/70 hover:bg-[#343f4d] transition-colors min-w-[4rem]"
            >
              <span className="material-symbols-outlined text-amber-400 text-lg shrink-0">warning</span>
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide leading-none">Alert</p>
                <p className="text-sm font-mono font-semibold text-amber-300 leading-tight uppercase">{alertLevel}</p>
              </div>
            </Link>
          </div>
        </header>

        {/* Video + 2D map always visible (map renders even without WS) */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-3 p-3 bg-[#0b0e11]">
          <section className="flex-1 flex flex-col min-h-0 min-w-0 lg:min-h-[200px]">
            <VideoPlayer />
          </section>
          <section className="flex flex-col min-h-[280px] lg:min-h-0 lg:w-[min(440px,42vw)] lg:max-w-[480px] shrink-0 border border-[#2a3441] rounded-lg overflow-hidden bg-[#111418]">
            <FloorPlan />
          </section>
        </div>
      </div>
    </div>
  );
}
