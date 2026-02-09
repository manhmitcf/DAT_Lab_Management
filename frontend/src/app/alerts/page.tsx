'use client';

import { useState } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import { alerts } from '@/lib/mockData';

type FilterType = 'all' | 'falls' | 'intrusions' | 'fighting';

export default function AlertsPage() {
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const activeAlerts = alerts.filter(a => !a.resolved);

    const filteredAlerts = alerts.filter((alert) => {
        const matchesFilter = filter === 'all' ||
            (filter === 'falls' && alert.event.toLowerCase().includes('fall')) ||
            (filter === 'intrusions' && alert.event.toLowerCase().includes('intrusion')) ||
            (filter === 'fighting' && alert.event.toLowerCase().includes('fighting'));

        const matchesSearch = searchQuery === '' ||
            alert.event.toLowerCase().includes(searchQuery.toLowerCase()) ||
            alert.location.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesFilter && matchesSearch;
    });

    const getAlertStyle = (type: string) => {
        if (type === 'critical') {
            return {
                bg: 'bg-gradient-to-r from-red-500/15 to-transparent border-l-4 border-l-red-500',
                badge: 'bg-red-500 text-white',
                icon: 'text-red-500',
            };
        }
        if (type === 'high') {
            return {
                bg: 'bg-gradient-to-r from-orange-500/10 to-transparent border-l-4 border-l-orange-500',
                badge: 'bg-orange-500 text-white',
                icon: 'text-orange-500',
            };
        }
        return {
            bg: 'bg-[#1B2431]',
            badge: 'bg-slate-600 text-white',
            icon: 'text-slate-400',
        };
    };

    const resolveAlert = (alertId: string) => {
        console.log('Resolving alert:', alertId);
    };

    return (
        <div className="flex h-screen w-full bg-[#101922]">
            <MainSidebar />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Filter Bar */}
                <div className="px-6 py-4 bg-[#1B2431]/50 border-b border-[#2a3441] flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-500">warning</span>
                            <h1 className="text-lg font-bold text-white">Alert Management</h1>
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
                                {activeAlerts.length} Active
                            </span>
                        </div>
                        <div className="h-6 w-px bg-[#2a3441]"></div>
                        <div className="flex gap-2">
                            {(['all', 'falls', 'intrusions', 'fighting'] as FilterType[]).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f
                                        ? 'bg-white text-[#101922]'
                                        : 'bg-[#1B2431] text-slate-400 hover:text-white border border-[#2a3441]'
                                        }`}
                                >
                                    {f === 'all' ? 'All Events' : f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-64">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#101922] border border-[#2a3441] rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-[#137fec] focus:border-[#137fec] placeholder:text-slate-500"
                                placeholder="Search alerts..."
                            />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#1B2431] border border-[#2a3441] rounded-lg text-xs font-medium text-slate-400">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            System Online
                        </div>
                    </div>
                </div>

                {/* Alert List */}
                <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-col">
                        {filteredAlerts.map((alert) => {
                            const style = getAlertStyle(alert.type);
                            return (
                                <div
                                    key={alert.id}
                                    className={`flex items-center px-6 py-4 border-b border-[#2a3441] group ${style.bg}`}
                                >
                                    <div className="flex-1 flex items-center gap-5">
                                        <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${alert.type === 'critical' ? 'bg-red-500/20' :
                                            alert.type === 'high' ? 'bg-orange-500/20' : 'bg-[#2a3441]'
                                            }`}>
                                            <span className={`material-symbols-outlined text-2xl ${style.icon}`}>
                                                {alert.icon}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-base font-bold text-white">{alert.event}</h3>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${style.badge}`}>
                                                    {alert.type.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-sm text-slate-300">{alert.camera} • {alert.location}</span>
                                                <span className="text-sm text-slate-500 font-mono">{alert.timestamp}</span>
                                                <span className="text-xs text-slate-500">Confidence: {(alert.confidence * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1B2431] border border-[#2a3441] text-white text-sm font-medium hover:bg-[#2d3b4e] transition-colors">
                                            <span className="material-symbols-outlined text-lg">videocam</span>
                                            View Clip
                                        </button>
                                        <button
                                            onClick={() => resolveAlert(alert.id)}
                                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-colors ${alert.type === 'critical' || alert.type === 'high'
                                                ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                                                : 'bg-[#1B2431] border border-[#2a3441] text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-lg">check_circle</span>
                                            Resolve
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <footer className="flex-shrink-0 px-6 py-3 bg-[#1B2431] border-t border-[#2a3441] flex justify-between items-center text-xs text-slate-400">
                    <div className="flex gap-6">
                        <span className="flex items-center gap-1.5"><b className="text-white">128</b> Events Today</span>
                        <span className="flex items-center gap-1.5"><b className="text-emerald-400">98%</b> Resolution Rate</span>
                    </div>
                    <div>Page 1 of 12</div>
                </footer>
            </main>
        </div>
    );
}
