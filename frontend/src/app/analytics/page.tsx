'use client';

import MainSidebar from '@/components/layout/MainSidebar';
import { analyticsData } from '@/lib/mockData';

export default function AnalyticsPage() {
    return (
        <div className="flex h-screen w-full bg-[#14181f]">
            <MainSidebar />

            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                {/* Header */}
                <header className="flex items-center justify-between border-b border-white/10 px-8 py-4 bg-[#14181f]/50 sticky top-0 z-50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#30bae8]/10 rounded-lg">
                            <span className="material-symbols-outlined text-[#30bae8] text-3xl">radar</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-white">
                                EdgeSentinel<span className="text-[#30bae8]">AI</span>
                            </h1>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
                                Behavioral Intelligence Console
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-[#20262F] rounded-lg p-1 border border-white/5">
                            <button className="px-4 py-1.5 text-xs font-bold rounded-md bg-[#30bae8] text-[#14181f] transition-all">
                                Last 1h
                            </button>
                            <button className="px-4 py-1.5 text-xs font-bold rounded-md text-white/60 hover:text-white transition-all">
                                Today
                            </button>
                            <button className="px-4 py-1.5 text-xs font-bold rounded-md text-white/60 hover:text-white transition-all">
                                Custom
                            </button>
                        </div>
                        <button className="flex items-center justify-center p-2 rounded-lg bg-[#20262F] border border-white/5 text-white/70 hover:text-[#30bae8] transition-colors">
                            <span className="material-symbols-outlined">calendar_today</span>
                        </button>
                        <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
                        <button className="flex items-center justify-center p-2 rounded-lg bg-[#20262F] border border-white/5 text-white/70 hover:text-[#30bae8] transition-colors">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-grow flex flex-col p-8 max-w-[1600px] mx-auto w-full gap-8 overflow-y-auto">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
                        {/* Total Events */}
                        <div className="bg-[#20262F]/80 backdrop-blur-lg border border-[#3c4d53]/50 rounded-xl p-6 relative overflow-hidden group shadow-inner">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-5xl">analytics</span>
                            </div>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-2">Total Events Today</p>
                            <div className="flex items-baseline gap-3">
                                <h2 className="text-4xl font-bold tracking-tighter">{analyticsData.totalEventsToday.toLocaleString()}</h2>
                                <span className="text-[#6DB36D] text-xs font-bold flex items-center bg-[#6DB36D]/10 px-2 py-0.5 rounded-full">
                                    +{analyticsData.eventsChange}%
                                </span>
                            </div>
                            <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-[#30bae8]" style={{ width: '65%' }}></div>
                            </div>
                        </div>

                        {/* Avg Confidence */}
                        <div className="bg-[#20262F]/80 backdrop-blur-lg border border-[#3c4d53]/50 rounded-xl p-6 relative overflow-hidden group shadow-inner">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-5xl">verified_user</span>
                            </div>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-2">Avg. Detection Confidence</p>
                            <div className="flex items-baseline gap-3">
                                <h2 className="text-4xl font-bold tracking-tighter">
                                    {analyticsData.avgConfidence}<span className="text-2xl font-light text-white/40">%</span>
                                </h2>
                                <span className="text-[#F25F4C] text-xs font-bold flex items-center bg-[#F25F4C]/10 px-2 py-0.5 rounded-full">
                                    {analyticsData.confidenceChange}%
                                </span>
                            </div>
                            <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-[#30bae8]" style={{ width: `${analyticsData.avgConfidence}%` }}></div>
                            </div>
                        </div>

                        {/* Peak Time */}
                        <div className="bg-[#20262F]/80 backdrop-blur-lg border border-[#3c4d53]/50 rounded-xl p-6 relative overflow-hidden group border-l-4 border-l-[#30bae8] shadow-inner">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-5xl">schedule</span>
                            </div>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-2">Peak Occupancy Time</p>
                            <div className="flex items-baseline gap-3">
                                <h2 className="text-4xl font-bold tracking-tighter">{analyticsData.peakTime}</h2>
                                <span className="text-white/30 text-xs font-medium">{analyticsData.peakOccupancy} People</span>
                            </div>
                            <p className="text-[10px] text-white/30 mt-4 italic">Detected in {analyticsData.peakZone} Zone</p>
                        </div>

                        {/* System Uptime */}
                        <div className="bg-[#20262F]/80 backdrop-blur-lg border border-[#3c4d53]/50 rounded-xl p-6 relative overflow-hidden group shadow-inner">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-5xl">hub</span>
                            </div>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-2">System Uptime</p>
                            <div className="flex items-center gap-3">
                                <h2 className="text-4xl font-bold tracking-tighter">
                                    {analyticsData.systemUptime}<span className="text-2xl font-light text-white/40">%</span>
                                </h2>
                                <div className="size-3 rounded-full bg-[#6DB36D] animate-pulse shadow-[0_0_10px_rgba(109,179,109,0.5)]"></div>
                            </div>
                            <p className="text-[10px] text-[#6DB36D] mt-4 uppercase font-bold tracking-wider">All edge nodes active</p>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
                        {/* Behavior Trends Chart */}
                        <div className="lg:col-span-2 bg-[#20262F]/80 backdrop-blur-lg border border-[#3c4d53]/50 rounded-xl p-8 flex flex-col min-h-[500px] shadow-inner">
                            <div className="flex justify-between items-start mb-12">
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Behavior Trends (24h)</h3>
                                    <p className="text-base text-white/40">Real-time movement classification across all sensors</p>
                                </div>
                                <div className="flex gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="size-3 rounded-full bg-[#30bae8]"></div>
                                        <span className="text-xs uppercase font-bold tracking-wider text-white/60">Walking</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="size-3 rounded-full bg-[#6DB36D]"></div>
                                        <span className="text-xs uppercase font-bold tracking-wider text-white/60">Standing</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="size-3 rounded-full bg-[#F25F4C]"></div>
                                        <span className="text-xs uppercase font-bold tracking-wider text-white/60">Falls</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-grow w-full relative">
                                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
                                    <defs>
                                        <linearGradient id="primary-grad" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="#30bae8" stopOpacity="0.3"></stop>
                                            <stop offset="100%" stopColor="#30bae8" stopOpacity="0"></stop>
                                        </linearGradient>
                                    </defs>
                                    <line stroke="rgba(255,255,255,0.05)" strokeDasharray="4" x1="0" x2="1000" y1="50" y2="50"></line>
                                    <line stroke="rgba(255,255,255,0.05)" strokeDasharray="4" x1="0" x2="1000" y1="150" y2="150"></line>
                                    <line stroke="rgba(255,255,255,0.05)" strokeDasharray="4" x1="0" x2="1000" y1="250" y2="250"></line>
                                    <path
                                        d="M0,250 L50,220 L100,240 L150,180 L200,200 L250,140 L300,160 L350,100 L400,120 L450,40 L500,60 L550,130 L600,110 L650,180 L700,160 L750,220 L800,200 L850,260 L900,240 L950,280 L1000,250 V300 H0 Z"
                                        fill="url(#primary-grad)"
                                    ></path>
                                    <path
                                        d="M0,250 L50,220 L100,240 L150,180 L200,200 L250,140 L300,160 L350,100 L400,120 L450,40 L500,60 L550,130 L600,110 L650,180 L700,160 L750,220 L800,200 L850,260 L900,240 L950,280 L1000,250"
                                        fill="none"
                                        stroke="#30bae8"
                                        strokeLinejoin="round"
                                        strokeWidth="4"
                                    ></path>
                                    <path
                                        d="M0,290 L400,290 L450,270 L500,290 L1000,290"
                                        fill="none"
                                        stroke="#F25F4C"
                                        strokeWidth="3"
                                    ></path>
                                </svg>
                                <div className="flex justify-between mt-8 px-2">
                                    <span className="text-xs text-white/30 font-bold">00:00</span>
                                    <span className="text-xs text-white/30 font-bold">06:00</span>
                                    <span className="text-xs text-white/30 font-bold">12:00</span>
                                    <span className="text-xs text-white/30 font-bold">18:00</span>
                                    <span className="text-xs text-white/30 font-bold">23:59</span>
                                </div>
                            </div>
                        </div>

                        {/* Alert Distribution */}
                        <div className="bg-[#20262F]/80 backdrop-blur-lg border border-[#3c4d53]/50 rounded-xl p-8 flex flex-col min-h-[500px] shadow-inner">
                            <h3 className="text-2xl font-bold text-white mb-2">Alert Distribution</h3>
                            <p className="text-base text-white/40 mb-12">Incident breakdown by type</p>

                            {/* Donut Chart */}
                            <div className="flex-grow flex items-center justify-center relative mb-12">
                                <div className="relative size-64 rounded-full border-[16px] border-white/5 flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border-[16px] border-[#30bae8] border-t-transparent border-l-transparent rotate-[45deg]"></div>
                                    <div className="absolute inset-0 rounded-full border-[16px] border-[#FAD232] border-b-transparent border-r-transparent border-l-transparent -rotate-[15deg]"></div>
                                    <div className="absolute inset-0 rounded-full border-[16px] border-[#F25F4C] border-r-transparent border-b-transparent border-t-transparent rotate-[180deg]"></div>
                                    <div className="text-center">
                                        <span className="block text-5xl font-bold tracking-tighter">1,240</span>
                                        <span className="text-xs uppercase text-white/40 font-bold mt-2 block">Total Alerts</span>
                                    </div>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between group cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="size-4 rounded-sm bg-[#FAD232]"></div>
                                        <span className="text-base font-medium text-white/70">Loitering</span>
                                    </div>
                                    <span className="text-base font-bold">
                                        {analyticsData.alertDistribution.loitering.count} ({analyticsData.alertDistribution.loitering.percentage}%)
                                    </span>
                                </div>
                                <div className="flex items-center justify-between group cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="size-4 rounded-sm bg-[#F25F4C]"></div>
                                        <span className="text-base font-medium text-white/70">Fall Detected</span>
                                    </div>
                                    <span className="text-base font-bold">
                                        {analyticsData.alertDistribution.fall.count} ({analyticsData.alertDistribution.fall.percentage}%)
                                    </span>
                                </div>
                                <div className="flex items-center justify-between group cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="size-4 rounded-sm bg-[#30bae8]"></div>
                                        <span className="text-base font-medium text-white/70">Area Breach</span>
                                    </div>
                                    <span className="text-base font-bold">
                                        {analyticsData.alertDistribution.areaBreach.count} ({analyticsData.alertDistribution.areaBreach.percentage}%)
                                    </span>
                                </div>
                                <div className="flex items-center justify-between group cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="size-4 rounded-sm bg-white/20"></div>
                                        <span className="text-base font-medium text-white/70">Other</span>
                                    </div>
                                    <span className="text-base font-bold">
                                        {analyticsData.alertDistribution.other.count} ({analyticsData.alertDistribution.other.percentage}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="mt-auto p-8 border-t border-white/5 bg-[#14181f]/30">
                    <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-6">
                            <span className="text-xs text-white/40">© 2024 EdgeSentinelAI Systems</span>
                            <a className="text-xs text-white/40 hover:text-white transition-colors" href="#">Security Protocols</a>
                            <a className="text-xs text-white/40 hover:text-white transition-colors" href="#">API Docs</a>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-[#6DB36D]"></div>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Edge Node: Active (NYC-01)</span>
                            </div>
                            <div className="h-4 w-[1px] bg-white/10"></div>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">V 2.4.0-Stable</span>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
