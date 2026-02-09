'use client';

import MainSidebar from '@/components/layout/MainSidebar';
import { dashboardStats, edgeDevices, alerts, cameraFeeds, detectionActivity } from '@/lib/mockData';

export default function DashboardPage() {
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'online':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                        <span className="size-1.5 rounded-full bg-green-500"></span>
                        Online
                    </span>
                );
            case 'heavy':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                        <span className="size-1.5 rounded-full bg-yellow-500"></span>
                        Heavy
                    </span>
                );
            case 'offline':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                        <span className="size-1.5 rounded-full bg-red-500"></span>
                        Offline
                    </span>
                );
            default:
                return null;
        }
    };

    const getCpuColor = (load: number) => {
        if (load > 80) return 'bg-yellow-500';
        if (load > 60) return 'bg-blue-500';
        return 'bg-green-500';
    };

    return (
        <div className="flex h-screen w-full bg-[#101922]">
            <MainSidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-8 py-6 border-b border-[#2a3441] shrink-0">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-white text-3xl font-bold tracking-tight">System Overview</h1>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <p className="text-slate-400 text-sm font-normal">Real-time Analysis Online | Last updated: just now</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 bg-[#1B2431] hover:bg-slate-700 text-white px-4 py-2 rounded-lg border border-[#2a3441] transition-all text-sm font-medium">
                            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                            Last 24 Hours
                        </button>
                        <button className="flex items-center gap-2 bg-[#137fec] hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-lg shadow-blue-500/20">
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Add Device
                        </button>
                    </div>
                </header>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            {/* Card 1 - Active Cameras */}
                            <div className="bg-[#1B2431] p-6 rounded-xl border border-[#2a3441] flex flex-col justify-between h-[160px] relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <span className="material-symbols-outlined text-6xl text-[#137fec]">videocam</span>
                                </div>
                                <div className="flex flex-col gap-1 z-10">
                                    <p className="text-slate-400 text-sm font-medium">Active Cameras</p>
                                    <h3 className="text-white text-3xl font-bold">
                                        {dashboardStats.activeCameras} <span className="text-lg text-slate-500 font-medium">/ {dashboardStats.totalCameras}</span>
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2 mt-auto z-10">
                                    <div className="px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-semibold">
                                        +{dashboardStats.cameraChange} devices
                                    </div>
                                    <span className="text-slate-400 text-xs">Since yesterday</span>
                                </div>
                            </div>

                            {/* Card 2 - People Tracked */}
                            <div className="bg-[#1B2431] p-6 rounded-xl border border-[#2a3441] flex flex-col justify-between h-[160px] relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <span className="material-symbols-outlined text-6xl text-purple-500">accessibility_new</span>
                                </div>
                                <div className="flex flex-col gap-1 z-10">
                                    <p className="text-slate-400 text-sm font-medium">People Tracked</p>
                                    <h3 className="text-white text-3xl font-bold">{dashboardStats.peopleTracked}</h3>
                                </div>
                                <div className="flex items-center gap-2 mt-auto z-10">
                                    <div className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold">
                                        +{dashboardStats.peopleChange}%
                                    </div>
                                    <span className="text-slate-400 text-xs">Current Load</span>
                                </div>
                            </div>

                            {/* Card 3 - Total Alerts */}
                            <div className="bg-[#1B2431] p-6 rounded-xl border border-[#2a3441] flex flex-col justify-between h-[160px] relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <span className="material-symbols-outlined text-6xl text-orange-500">warning</span>
                                </div>
                                <div className="flex flex-col gap-1 z-10">
                                    <p className="text-slate-400 text-sm font-medium">Total Alerts (Today)</p>
                                    <h3 className="text-white text-3xl font-bold">{dashboardStats.totalAlerts}</h3>
                                </div>
                                <div className="flex items-center gap-2 mt-auto z-10">
                                    <div className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold">
                                        +{dashboardStats.criticalAlerts} critical
                                    </div>
                                    <span className="text-slate-400 text-xs">Needs Review</span>
                                </div>
                            </div>

                            {/* Card 4 - GPU Load */}
                            <div className="bg-[#1B2431] p-6 rounded-xl border border-[#2a3441] flex flex-col justify-between h-[160px] relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <span className="material-symbols-outlined text-6xl text-blue-500">memory</span>
                                </div>
                                <div className="flex flex-col gap-1 z-10">
                                    <p className="text-slate-400 text-sm font-medium">Avg Edge GPU Load</p>
                                    <h3 className="text-white text-3xl font-bold">{dashboardStats.avgGpuLoad}%</h3>
                                </div>
                                <div className="flex items-center gap-2 mt-auto z-10">
                                    <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full" style={{ width: `${dashboardStats.avgGpuLoad}%` }}></div>
                                    </div>
                                    <span className="text-slate-400 text-xs">Stable</span>
                                </div>
                            </div>
                        </div>

                        {/* Main Grid Area */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Chart Section (2 cols) */}
                            <div className="lg:col-span-2 flex flex-col gap-6">
                                {/* Detection Chart */}
                                <div className="bg-[#1B2431] rounded-xl border border-[#2a3441] p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-lg font-bold text-white">Detection Activity</h2>
                                            <p className="text-sm text-slate-400">Human presence detection over 24h</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-[#137fec] font-bold text-2xl">{dashboardStats.totalDetections.toLocaleString()}</span>
                                            <span className="text-sm text-slate-400 self-end mb-1">Total Detections</span>
                                        </div>
                                    </div>
                                    <div className="h-[250px] w-full relative">
                                        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 50">
                                            <line stroke="#2a3441" strokeWidth="0.2" x1="0" x2="100" y1="40" y2="40"></line>
                                            <line stroke="#2a3441" strokeWidth="0.2" x1="0" x2="100" y1="30" y2="30"></line>
                                            <line stroke="#2a3441" strokeWidth="0.2" x1="0" x2="100" y1="20" y2="20"></line>
                                            <line stroke="#2a3441" strokeWidth="0.2" x1="0" x2="100" y1="10" y2="10"></line>
                                            <defs>
                                                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                                    <stop offset="0%" stopColor="#137fec" stopOpacity="0.4"></stop>
                                                    <stop offset="100%" stopColor="#137fec" stopOpacity="0"></stop>
                                                </linearGradient>
                                            </defs>
                                            <path d="M0 45 L10 40 L20 42 L30 35 L40 25 L50 28 L60 15 L70 18 L80 10 L90 20 L100 15 V 50 H 0 Z" fill="url(#chartGradient)"></path>
                                            <path d="M0 45 L10 40 L20 42 L30 35 L40 25 L50 28 L60 15 L70 18 L80 10 L90 20 L100 15" fill="none" stroke="#137fec" strokeWidth="0.8"></path>
                                        </svg>
                                        <div className="flex justify-between mt-2 text-xs text-slate-400 font-mono">
                                            <span>00:00</span>
                                            <span>06:00</span>
                                            <span>12:00</span>
                                            <span>18:00</span>
                                            <span>24:00</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Edge Devices Status Table */}
                                <div className="bg-[#1B2431] rounded-xl border border-[#2a3441] overflow-hidden">
                                    <div className="p-6 border-b border-[#2a3441] flex justify-between items-center">
                                        <h2 className="text-lg font-bold text-white">Edge Devices Status</h2>
                                        <button className="text-sm text-[#137fec] hover:text-blue-400 font-medium">View All Devices</button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-[#151b24] text-slate-400 font-medium">
                                                <tr>
                                                    <th className="px-6 py-4">Device Name</th>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4">CPU Load</th>
                                                    <th className="px-6 py-4">RAM</th>
                                                    <th className="px-6 py-4">FPS</th>
                                                    <th className="px-6 py-4">Temp</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#2a3441] text-slate-300">
                                                {edgeDevices.map((device) => (
                                                    <tr key={device.id} className="hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-slate-400 text-lg">
                                                                {device.type === 'server' ? 'dns' : 'developer_board'}
                                                            </span>
                                                            {device.name}
                                                        </td>
                                                        <td className="px-6 py-4">{getStatusBadge(device.status)}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <span className="w-8 font-mono">{device.status === 'offline' ? '--' : `${device.cpuLoad}%`}</span>
                                                                <div className="w-20 h-1.5 bg-slate-700 rounded-full">
                                                                    {device.status !== 'offline' && (
                                                                        <div className={`${getCpuColor(device.cpuLoad)} h-full rounded-full`} style={{ width: `${device.cpuLoad}%` }}></div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 font-mono">
                                                            {device.status === 'offline' ? '--/--' : `${device.ramUsed}/${device.ramTotal}GB`}
                                                        </td>
                                                        <td className="px-6 py-4 font-mono text-white">
                                                            {device.status === 'offline' ? '-- FPS' : `${device.fps} FPS`}
                                                        </td>
                                                        <td className={`px-6 py-4 font-mono ${device.temperature > 60 ? 'text-yellow-500' : 'text-slate-400'}`}>
                                                            {device.status === 'offline' ? '--' : `${device.temperature}°C`}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Alerts & Camera Preview */}
                            <div className="flex flex-col gap-6">
                                {/* Recent Alerts */}
                                <div className="bg-[#1B2431] rounded-xl border border-[#2a3441] flex flex-col max-h-[400px]">
                                    <div className="p-5 border-b border-[#2a3441] flex justify-between items-center bg-[#151b24] rounded-t-xl">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-red-500">notifications_active</span>
                                            <h2 className="text-base font-bold text-white">Recent Alerts</h2>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">Live</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                                        {alerts.slice(0, 4).map((alert) => (
                                            <div
                                                key={alert.id}
                                                className={`flex flex-col gap-2 p-3 rounded-lg cursor-pointer group transition-colors ${alert.type === 'critical'
                                                        ? 'bg-red-500/5 border border-red-500/20 hover:bg-red-500/10'
                                                        : 'bg-slate-800/40 border border-slate-700 hover:bg-slate-800'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`material-symbols-outlined text-sm ${alert.type === 'critical' ? 'text-red-500' : alert.type === 'high' ? 'text-orange-400' : 'text-blue-400'
                                                            }`}>
                                                            {alert.icon}
                                                        </span>
                                                        <p className={`text-sm font-semibold ${alert.type === 'critical' ? 'text-red-400' : alert.type === 'high' ? 'text-orange-400' : 'text-blue-400'
                                                            }`}>
                                                            {alert.event}
                                                        </p>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 font-mono">{alert.timestamp}</p>
                                                </div>
                                                <p className="text-xs text-slate-300">{alert.camera} ({alert.location})</p>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="text-[10px] text-slate-500">Confidence: {(alert.confidence * 100).toFixed(0)}%</span>
                                                    <button className={`text-xs text-white px-3 py-1 rounded transition-colors opacity-0 group-hover:opacity-100 ${alert.type === 'critical' ? 'bg-red-600 hover:bg-red-500' : 'bg-slate-600 hover:bg-slate-500'
                                                        }`}>
                                                        Review
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-4 border-t border-[#2a3441]">
                                        <button className="w-full py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:text-white transition-colors">
                                            View All History
                                        </button>
                                    </div>
                                </div>

                                {/* Camera Preview Grid */}
                                <div className="bg-[#1B2431] rounded-xl border border-[#2a3441] p-4">
                                    <h3 className="text-sm font-bold text-white mb-3">Key Feeds Preview</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {cameraFeeds.map((feed) => (
                                            <div key={feed.id} className="relative aspect-video bg-black rounded overflow-hidden group cursor-pointer">
                                                <div
                                                    className="bg-cover bg-center h-full w-full opacity-80 group-hover:opacity-100 transition-opacity"
                                                    style={{ backgroundImage: `url("${feed.imageUrl}")` }}
                                                ></div>
                                                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/50 text-[10px] text-white rounded backdrop-blur-sm font-mono">
                                                    {feed.name}
                                                </div>
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                                    <span className="material-symbols-outlined text-white drop-shadow-lg">play_circle</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
