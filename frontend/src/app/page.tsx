'use client';

import { useState } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import StatsBar from '@/components/panels/StatsBar';
import CameraLayoutSelector from '@/components/video/CameraLayoutSelector';
import CameraGrid from '@/components/video/CameraGrid';
import FloorPlan from '@/components/panels/FloorPlan';

export default function LiveViewPage() {
  const [cameraLayout, setCameraLayout] = useState(4);
  const [showFloorPlan, setShowFloorPlan] = useState(true);

  return (
    <div className="flex h-screen w-full bg-[#101922]">
      <MainSidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#2a3441] bg-[#1B2431] px-6 py-3 shrink-0 z-50">
          <div className="flex items-center gap-4 text-white">
            <div className="size-8 flex items-center justify-center bg-[#137fec]/20 text-[#137fec] rounded-lg">
              <span className="material-symbols-outlined text-2xl">visibility</span>
            </div>
            <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
              EdgeSentinelAI
            </h2>
            <div className="h-4 w-px bg-[#2a3441] mx-2"></div>
            <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span>SYSTEM ONLINE</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Camera Layout Selector */}
            <CameraLayoutSelector
              selectedLayout={cameraLayout}
              onLayoutChange={setCameraLayout}
            />

            {/* Floor Plan Toggle */}
            <button
              onClick={() => setShowFloorPlan(!showFloorPlan)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showFloorPlan
                  ? 'bg-[#137fec] text-white'
                  : 'bg-[#1B2431] border border-[#2a3441] text-slate-400 hover:text-white'
                }`}
            >
              <span className="material-symbols-outlined text-lg">map</span>
              <span className="hidden lg:inline">Floor Plan</span>
            </button>

            <div className="h-6 w-px bg-[#2a3441]"></div>

            <button className="flex items-center justify-center rounded-lg size-10 hover:bg-[#283039] text-white transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-[#1B2431]"></span>
            </button>
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border-2 border-[#2a3441]"
              style={{ backgroundImage: `url("https://ui-avatars.com/api/?name=Admin&background=137fec&color=fff")` }}
            ></div>
          </div>
        </header>

        {/* Stats Bar */}
        <StatsBar />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 flex flex-col bg-[#0b0e11] overflow-hidden p-4">
            {/* Camera Grid */}
            <CameraGrid layout={cameraLayout} />
          </main>

          {/* Floor Plan Panel (toggleable) */}
          {showFloorPlan && (
            <aside className="w-[380px] shrink-0 border-l border-[#2a3441] bg-[#111418] p-4 overflow-hidden flex flex-col">
              <FloorPlan />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
