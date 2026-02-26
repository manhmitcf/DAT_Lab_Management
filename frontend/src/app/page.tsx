'use client';

import { useState } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import StatsBar from '@/components/panels/StatsBar';
import CameraLayoutSelector from '@/components/video/CameraLayoutSelector';
import CameraGrid from '@/components/video/CameraGrid';
import FloorPlan from '@/components/panels/FloorPlan';
import Badge from '@/components/ui/Badge';
import { alerts } from '@/lib/mockData';

export default function LiveMonitorPage() {
  const [cameraLayout, setCameraLayout] = useState(4);
  const [showFloorPlan, setShowFloorPlan] = useState(true);
  const activeAlerts = alerts.filter(a => !a.resolved).slice(0, 4);

  return (
    <div className="flex h-screen w-full bg-surface-0">
      <MainSidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <StatsBar />

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden animate-fade-in">
          {/* Camera panel — takes priority */}
          <main className="flex-1 flex flex-col bg-surface-0 overflow-hidden">
            {/* Camera toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-default bg-surface-1/40">
              <div className="flex items-center gap-3">
                <h2 className="text-text-primary text-sm font-semibold">Live Feed</h2>
                <Badge variant="success" pulse>
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Live
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <CameraLayoutSelector
                  selectedLayout={cameraLayout}
                  onLayoutChange={setCameraLayout}
                />
                <div className="w-px h-6 bg-border-subtle mx-1" />
                <button
                  onClick={() => setShowFloorPlan(!showFloorPlan)}
                  className={`
                                        flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium
                                        transition-all duration-[var(--duration-fast)] active:scale-[0.97]
                                        ${showFloorPlan
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-surface-2 border border-border-default text-text-secondary hover:text-text-primary'
                    }
                                    `}
                >
                  <span className="material-symbols-outlined text-sm">map</span>
                  Floor Plan
                </button>
              </div>
            </div>

            {/* Camera grid */}
            <div className="flex-1 p-3 overflow-hidden">
              <CameraGrid layout={cameraLayout} />
            </div>
          </main>

          {/* Side panel — floor plan + intel */}
          {showFloorPlan && (
            <aside className="w-[360px] shrink-0 border-l border-border-default bg-surface-1 flex flex-col overflow-hidden animate-slide-in">
              {/* Floor plan — taller (takes more space) */}
              <div className="p-3 flex-[3] overflow-hidden flex flex-col">
                <FloorPlan />
              </div>

              {/* Sparkline — compact */}
              <div className="px-3 pb-2">
                <div className="bg-surface-2 rounded-[var(--radius-md)] border border-border-default p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-semibold text-text-primary">Detection Activity</h3>
                    <span className="text-[10px] text-text-tertiary font-mono">24h</span>
                  </div>
                  <div className="h-10 w-full relative">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40">
                      <defs>
                        <linearGradient id="miniChartGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0 35 L10 30 L20 32 L30 25 L40 18 L50 20 L60 10 L70 12 L80 6 L90 15 L100 10 V 40 H 0 Z" fill="url(#miniChartGradient)" />
                      <path d="M0 35 L10 30 L20 32 L30 25 L40 18 L50 20 L60 10 L70 12 L80 6 L90 15 L100 10" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Alert feed — scrollable */}
              <div className="border-t border-border-default p-3 flex-[2] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-danger text-sm">warning</span>
                    <h3 className="text-[11px] font-semibold text-text-primary">Recent Alerts</h3>
                  </div>
                  <Badge variant="danger">{alerts.filter(a => !a.resolved).length}</Badge>
                </div>
                <div className="space-y-1.5 overflow-y-auto flex-1 stagger-children">
                  {activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`
                                                flex items-start gap-2.5 p-2.5 rounded-[var(--radius-md)] cursor-pointer
                                                transition-colors duration-[var(--duration-fast)]
                                                ${alert.type === 'critical'
                          ? 'bg-danger-muted border border-danger/20 hover:bg-danger/15'
                          : 'bg-surface-2 border border-border-default hover:bg-surface-3'
                        }
                                            `}
                    >
                      <span className={`material-symbols-outlined text-sm mt-0.5 ${alert.type === 'critical' ? 'text-danger' :
                          alert.type === 'high' ? 'text-orange-400' : 'text-accent-strong'
                        }`}>
                        {alert.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${alert.type === 'critical' ? 'text-danger' : 'text-text-primary'
                          }`}>
                          {alert.event}
                        </p>
                        <p className="text-[10px] text-text-tertiary truncate mt-0.5">
                          {alert.camera} · {alert.location}
                        </p>
                      </div>
                      <span className="text-[10px] text-text-tertiary whitespace-nowrap font-mono">
                        {alert.timestamp}
                      </span>
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
