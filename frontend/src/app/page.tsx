'use client';

import { useState } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import StatsBar from '@/components/panels/StatsBar';
import CameraLayoutSelector from '@/components/video/CameraLayoutSelector';
import CameraGrid from '@/components/video/CameraGrid';
import FloorPlan from '@/components/panels/FloorPlan';
import { useTrackingStore } from '@/stores/trackingStore';
import { alerts, detectionActivity } from '@/lib/mockData';

export default function LiveMonitorPage() {
  const [cameraLayout, setCameraLayout] = useState(4);
  const [showFloorPlan, setShowFloorPlan] = useState(true);
  const stats = useTrackingStore((state) => state.stats);
  const activeAlerts = alerts.filter(a => !a.resolved).slice(0, 4);

  return (
    <div className="flex h-screen w-full bg-[#101922]">
      <MainSidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Stats Bar */}
        <StatsBar />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Camera View */}
          <main className="flex-1 flex flex-col bg-[#0b0e11] overflow-hidden">
            {/* Camera Controls */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3441]">
              <div className="flex items-center gap-3">
                <h2 className="text-white text-sm font-semibold">Live Feed</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CameraLayoutSelector
                  selectedLayout={cameraLayout}
                  onLayoutChange={setCameraLayout}
                />
                <button
                  onClick={() => setShowFloorPlan(!showFloorPlan)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showFloorPlan
                    ? 'bg-[#137fec] text-white'
                    : 'bg-[#1B2431] border border-[#2a3441] text-slate-400 hover:text-white'
                    }`}
                >
                  <span className="material-symbols-outlined text-sm">map</span>
                  Floor Plan
                </button>
              </div>
            </div>

            {/* Camera Grid */}
            <div className="flex-1 p-4 overflow-hidden">
              <CameraGrid layout={cameraLayout} />
            </div>
          </main>

          {/* Right Panel - Floor Plan + Alerts */}
          {showFloorPlan && (
            <aside className="w-[380px] shrink-0 border-l border-[#2a3441] bg-[#111418] flex flex-col overflow-hidden">
              {/* Floor Plan */}
              <div className="p-4 flex-1 overflow-hidden flex flex-col">
                <FloorPlan />
              </div>

              {/* Detection Activity Mini Chart */}
              <div className="px-4 pb-2">
                <div className="bg-[#1B2431] rounded-lg border border-[#2a3441] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-white">Detection Activity</h3>
                    <span className="text-[10px] text-slate-400">Last 24h</span>
                  </div>
                  <div className="h-12 w-full relative">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40">
                      <defs>
                        <linearGradient id="miniChartGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#137fec" stopOpacity="0.4"></stop>
                          <stop offset="100%" stopColor="#137fec" stopOpacity="0"></stop>
                        </linearGradient>
                      </defs>
                      <path d="M0 35 L10 30 L20 32 L30 25 L40 18 L50 20 L60 10 L70 12 L80 6 L90 15 L100 10 V 40 H 0 Z" fill="url(#miniChartGradient)"></path>
                      <path d="M0 35 L10 30 L20 32 L30 25 L40 18 L50 20 L60 10 L70 12 L80 6 L90 15 L100 10" fill="none" stroke="#137fec" strokeWidth="1.5"></path>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Recent Alerts */}
              <div className="border-t border-[#2a3441] p-4 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500 text-sm">warning</span>
                    <h3 className="text-xs font-semibold text-white">Recent Alerts</h3>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">{alerts.filter(a => !a.resolved).length}</span>
                </div>
                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${alert.type === 'critical'
                        ? 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/15'
                        : 'bg-[#1B2431] border border-[#2a3441] hover:bg-slate-800'
                        }`}
                    >
                      <span className={`material-symbols-outlined text-sm mt-0.5 ${alert.type === 'critical' ? 'text-red-500' : alert.type === 'high' ? 'text-orange-400' : 'text-blue-400'
                        }`}>
                        {alert.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${alert.type === 'critical' ? 'text-red-400' : 'text-white'
                          }`}>
                          {alert.event}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{alert.camera} • {alert.location}</p>
                      </div>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">{alert.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
