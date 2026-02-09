'use client';

import { useState } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import { analyticsData } from '@/lib/mockData';

type TimeFrame = '1h' | 'today' | '7d' | '30d' | 'custom';

export default function AnalyticsPage() {
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('today');

    const timeFrameOptions: { value: TimeFrame; label: string }[] = [
        { value: '1h', label: 'Last Hour' },
        { value: 'today', label: 'Today' },
        { value: '7d', label: '7 Days' },
        { value: '30d', label: '30 Days' },
    ];

    // Dynamic data based on time frame (simulated)
    const getMultiplier = () => {
        switch (timeFrame) {
            case '1h': return 0.04;
            case 'today': return 1;
            case '7d': return 7;
            case '30d': return 30;
            default: return 1;
        }
    };

    const multiplier = getMultiplier();
    const totalEvents = Math.round(analyticsData.totalEventsToday * multiplier);

    return (
        <div className="flex h-screen w-full bg-[#101922]">
            <MainSidebar />

            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                {/* Time Frame Selector Bar */}
                <div className="px-6 py-4 bg-[#1B2431]/50 border-b border-[#2a3441] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#137fec]">analytics</span>
                            <h1 className="text-lg font-bold text-white">Analytics Dashboard</h1>
                        </div>
                        <div className="h-6 w-px bg-[#2a3441]"></div>
                        <div className="flex bg-[#101922] rounded-lg p-1 border border-[#2a3441]">
                            {timeFrameOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setTimeFrame(option.value)}
                                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${timeFrame === option.value
                                        ? 'bg-[#137fec] text-white'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1B2431] border border-[#2a3441] text-slate-400 hover:text-white transition-colors text-sm">
                            <span className="material-symbols-outlined text-lg">download</span>
                            Export Report
                        </button>
                        <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Real-time sync
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <main className="flex-grow flex flex-col p-6 gap-6 overflow-y-auto">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                        {/* Total Events */}
                        <div className="bg-[#1B2431] border border-[#2a3441] rounded-xl p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-4xl text-[#137fec]">analytics</span>
                            </div>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Total Detections</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-3xl font-bold text-white">{totalEvents.toLocaleString()}</h2>
                                <span className="text-emerald-400 text-xs font-medium flex items-center bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                    +{analyticsData.eventsChange}%
                                </span>
                            </div>
                            <div className="mt-3 h-1 w-full bg-[#2a3441] rounded-full overflow-hidden">
                                <div className="h-full bg-[#137fec]" style={{ width: '65%' }}></div>
                            </div>
                        </div>

                        {/* Avg Confidence */}
                        <div className="bg-[#1B2431] border border-[#2a3441] rounded-xl p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-4xl text-emerald-500">verified</span>
                            </div>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Detection Accuracy</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-3xl font-bold text-white">
                                    {analyticsData.avgConfidence}<span className="text-xl font-light text-slate-500">%</span>
                                </h2>
                                <span className="text-orange-400 text-xs font-medium flex items-center bg-orange-500/10 px-2 py-0.5 rounded-full">
                                    {analyticsData.confidenceChange}%
                                </span>
                            </div>
                            <div className="mt-3 h-1 w-full bg-[#2a3441] rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${analyticsData.avgConfidence}%` }}></div>
                            </div>
                        </div>

                        {/* Peak Occupancy */}
                        <div className="bg-[#1B2431] border border-[#2a3441] rounded-xl p-5 relative overflow-hidden group border-l-4 border-l-[#137fec]">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-4xl text-purple-500">schedule</span>
                            </div>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Peak Occupancy</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-3xl font-bold text-white">{analyticsData.peakTime}</h2>
                                <span className="text-slate-400 text-xs">{analyticsData.peakOccupancy} people</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">{analyticsData.peakZone} Zone</p>
                        </div>

                        {/* System Health */}
                        <div className="bg-[#1B2431] border border-[#2a3441] rounded-xl p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-4xl text-emerald-500">monitoring</span>
                            </div>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">System Uptime</p>
                            <div className="flex items-center gap-2">
                                <h2 className="text-3xl font-bold text-white">
                                    {analyticsData.systemUptime}<span className="text-xl font-light text-slate-500">%</span>
                                </h2>
                                <div className="size-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                            </div>
                            <p className="text-xs text-emerald-400 mt-2 font-medium">All nodes operational</p>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
                        {/* Occupancy Trends Chart */}
                        <div className="lg:col-span-2 bg-[#1B2431] border border-[#2a3441] rounded-xl p-6 flex flex-col min-h-[400px]">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">Occupancy Trends</h3>
                                    <p className="text-sm text-slate-400">Real-time movement patterns across all zones</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="size-2.5 rounded-full bg-[#137fec]"></div>
                                        <span className="text-xs text-slate-400">Occupancy</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="size-2.5 rounded-full bg-emerald-500"></div>
                                        <span className="text-xs text-slate-400">Ingress</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="size-2.5 rounded-full bg-orange-500"></div>
                                        <span className="text-xs text-slate-400">Egress</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-grow w-full relative">
                                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
                                    <defs>
                                        <linearGradient id="occupancyGrad" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="#137fec" stopOpacity="0.3"></stop>
                                            <stop offset="100%" stopColor="#137fec" stopOpacity="0"></stop>
                                        </linearGradient>
                                    </defs>
                                    {/* Grid lines */}
                                    <line stroke="rgba(255,255,255,0.05)" x1="0" x2="1000" y1="60" y2="60"></line>
                                    <line stroke="rgba(255,255,255,0.05)" x1="0" x2="1000" y1="120" y2="120"></line>
                                    <line stroke="rgba(255,255,255,0.05)" x1="0" x2="1000" y1="180" y2="180"></line>
                                    <line stroke="rgba(255,255,255,0.05)" x1="0" x2="1000" y1="240" y2="240"></line>
                                    {/* Occupancy area */}
                                    <path
                                        d="M0,250 L100,220 L200,180 L300,200 L400,140 L500,160 L600,100 L700,120 L800,80 L900,110 L1000,90 V300 H0 Z"
                                        fill="url(#occupancyGrad)"
                                    ></path>
                                    {/* Occupancy line */}
                                    <path
                                        d="M0,250 L100,220 L200,180 L300,200 L400,140 L500,160 L600,100 L700,120 L800,80 L900,110 L1000,90"
                                        fill="none"
                                        stroke="#137fec"
                                        strokeWidth="3"
                                        strokeLinejoin="round"
                                    ></path>
                                    {/* Ingress line */}
                                    <path
                                        d="M0,280 L100,260 L200,240 L300,250 L400,200 L500,210 L600,180 L700,190 L800,150 L900,170 L1000,160"
                                        fill="none"
                                        stroke="#10b981"
                                        strokeWidth="2"
                                        strokeDasharray="5,5"
                                    ></path>
                                    {/* Egress line */}
                                    <path
                                        d="M0,290 L100,275 L200,260 L300,270 L400,235 L500,245 L600,220 L700,230 L800,200 L900,215 L1000,205"
                                        fill="none"
                                        stroke="#f97316"
                                        strokeWidth="2"
                                        strokeDasharray="5,5"
                                    ></path>
                                </svg>
                                <div className="flex justify-between mt-4 px-2">
                                    <span className="text-xs text-slate-500 font-mono">00:00</span>
                                    <span className="text-xs text-slate-500 font-mono">06:00</span>
                                    <span className="text-xs text-slate-500 font-mono">12:00</span>
                                    <span className="text-xs text-slate-500 font-mono">18:00</span>
                                    <span className="text-xs text-slate-500 font-mono">Now</span>
                                </div>
                            </div>
                        </div>

                        {/* Alert Distribution */}
                        <div className="bg-[#1B2431] border border-[#2a3441] rounded-xl p-6 flex flex-col min-h-[400px]">
                            <h3 className="text-lg font-bold text-white mb-1">Alert Distribution</h3>
                            <p className="text-sm text-slate-400 mb-6">Incident breakdown by category</p>

                            {/* Donut Chart */}
                            <div className="flex-grow flex items-center justify-center relative mb-6">
                                <div className="relative size-44 rounded-full border-[12px] border-[#2a3441] flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border-[12px] border-[#137fec] border-t-transparent border-l-transparent rotate-[45deg]"></div>
                                    <div className="absolute inset-0 rounded-full border-[12px] border-amber-500 border-b-transparent border-r-transparent border-l-transparent -rotate-[15deg]"></div>
                                    <div className="absolute inset-0 rounded-full border-[12px] border-red-500 border-r-transparent border-b-transparent border-t-transparent rotate-[180deg]"></div>
                                    <div className="text-center">
                                        <span className="block text-3xl font-bold text-white">1,240</span>
                                        <span className="text-[10px] uppercase text-slate-400 font-medium">Total</span>
                                    </div>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-3 rounded-sm bg-amber-500"></div>
                                        <span className="text-sm text-slate-300">Loitering</span>
                                    </div>
                                    <span className="text-sm font-medium text-white">
                                        {analyticsData.alertDistribution.loitering.count} ({analyticsData.alertDistribution.loitering.percentage}%)
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-3 rounded-sm bg-red-500"></div>
                                        <span className="text-sm text-slate-300">Fall Detection</span>
                                    </div>
                                    <span className="text-sm font-medium text-white">
                                        {analyticsData.alertDistribution.fall.count} ({analyticsData.alertDistribution.fall.percentage}%)
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-3 rounded-sm bg-[#137fec]"></div>
                                        <span className="text-sm text-slate-300">Zone Breach</span>
                                    </div>
                                    <span className="text-sm font-medium text-white">
                                        {analyticsData.alertDistribution.areaBreach.count} ({analyticsData.alertDistribution.areaBreach.percentage}%)
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-3 rounded-sm bg-slate-500"></div>
                                        <span className="text-sm text-slate-300">Other</span>
                                    </div>
                                    <span className="text-sm font-medium text-white">
                                        {analyticsData.alertDistribution.other.count} ({analyticsData.alertDistribution.other.percentage}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Hourly Activity Heatmap */}
                        <div className="bg-[#1B2431] border border-[#2a3441] rounded-xl p-6">
                            <h3 className="text-lg font-bold text-white mb-1">Hourly Activity</h3>
                            <p className="text-sm text-slate-400 mb-4">Peak hours analysis</p>
                            <div className="grid grid-cols-12 gap-1">
                                {Array.from({ length: 24 }, (_, i) => {
                                    const intensity = Math.random();
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-1">
                                            <div
                                                className="w-full aspect-square rounded"
                                                style={{
                                                    backgroundColor: `rgba(19, 127, 236, ${0.1 + intensity * 0.9})`,
                                                }}
                                            ></div>
                                            {i % 4 === 0 && (
                                                <span className="text-[9px] text-slate-500">{i}:00</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex items-center justify-between mt-4">
                                <span className="text-xs text-slate-500">Low activity</span>
                                <div className="flex gap-1">
                                    {[0.1, 0.3, 0.5, 0.7, 0.9].map((opacity, i) => (
                                        <div
                                            key={i}
                                            className="w-4 h-2 rounded"
                                            style={{ backgroundColor: `rgba(19, 127, 236, ${opacity})` }}
                                        ></div>
                                    ))}
                                </div>
                                <span className="text-xs text-slate-500">High activity</span>
                            </div>
                        </div>

                        {/* Behavior Classification */}
                        <div className="bg-[#1B2431] border border-[#2a3441] rounded-xl p-6">
                            <h3 className="text-lg font-bold text-white mb-1">Behavior Classification</h3>
                            <p className="text-sm text-slate-400 mb-4">AI-detected behavior distribution</p>
                            <div className="space-y-4">
                                {[
                                    { label: 'Walking', value: 68, color: '#137fec' },
                                    { label: 'Standing', value: 24, color: '#10b981' },
                                    { label: 'Sitting', value: 5, color: '#8b5cf6' },
                                    { label: 'Loitering', value: 3, color: '#f59e0b' },
                                ].map((behavior) => (
                                    <div key={behavior.label}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm text-slate-300">{behavior.label}</span>
                                            <span className="text-sm font-medium text-white">{behavior.value}%</span>
                                        </div>
                                        <div className="h-2 bg-[#2a3441] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${behavior.value}%`, backgroundColor: behavior.color }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
