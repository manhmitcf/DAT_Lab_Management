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
                bg: 'bg-gradient-to-r from-[#ff4d4d]/15 to-transparent border-l-4 border-l-[#ff4d4d]',
                badge: 'bg-[#ff4d4d] text-white',
                icon: 'text-[#ff4d4d]',
            };
        }
        if (type === 'high') {
            return {
                bg: 'bg-gradient-to-r from-[#fb923c]/10 to-transparent border-l-4 border-l-[#fb923c]',
                badge: 'bg-[#fb923c] text-[#0a0f14]',
                icon: 'text-[#fb923c]',
            };
        }
        return {
            bg: 'bg-[#0a0f14]',
            badge: '',
            icon: 'text-[#94a3b8]',
        };
    };

    const resolveAlert = (alertId: string) => {
        // In real app, this would update the store
        console.log('Resolving alert:', alertId);
    };

    return (
        <div className="flex h-screen w-full bg-[#101922]">
            {/* Main Sidebar - Consistent with other pages */}
            <MainSidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="flex-shrink-0 px-8 py-6 border-b border-[#2a3441] flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                            Live Alert Log
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#ff4d4d]/20 text-[#ff4d4d] border border-[#ff4d4d]/30 uppercase tracking-wider">
                                {activeAlerts.length} Active
                            </span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1B2431] border border-[#2a3441] rounded-lg text-xs font-medium text-[#94a3b8]">
                            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
                            System Live
                        </div>
                        <button className="bg-[#137fec] hover:bg-[#0f6bd0] text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-[#137fec]/20 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">history</span>
                            Archive
                        </button>
                    </div>
                </header>

                {/* Filter Bar */}
                <div className="px-8 py-4 bg-[#1B2431]/50 border-b border-[#2a3441] flex items-center justify-between gap-4">
                    <div className="flex gap-2">
                        {(['all', 'falls', 'intrusions', 'fighting'] as FilterType[]).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f
                                    ? 'bg-white text-[#0a0f14]'
                                    : 'bg-[#1c2632] text-[#94a3b8] hover:text-white'
                                    }`}
                            >
                                {f === 'all' ? 'All Events' : f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-64">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#101922] border border-[#2a3441] rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:ring-[#137fec] focus:border-[#137fec]"
                            placeholder="Search alerts..."
                        />
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
                                    className={`alert-row flex items-center px-8 py-5 border-b border-[#2a3441] group ${style.bg}`}
                                >
                                    <div className="flex-1 flex items-center gap-6">
                                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${alert.type === 'critical' ? 'bg-[#ff4d4d]/20' :
                                            alert.type === 'high' ? 'bg-[#fb923c]/20' : 'bg-[#1c2632]'
                                            }`}>
                                            <span className={`material-symbols-outlined text-3xl ${style.icon}`}>
                                                {alert.icon}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-bold text-white uppercase tracking-tight">{alert.event}</h3>
                                                {style.badge && (
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded leading-none ${style.badge}`}>
                                                        {alert.type.toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1">
                                                <span className="text-sm text-white font-medium">{alert.camera} • {alert.location}</span>
                                                <span className="text-sm text-[#94a3b8] font-mono">{alert.timestamp}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1c2632] border border-[#2a3441] text-white text-sm font-semibold hover:bg-[#2d3b4e] transition-colors">
                                            <span className="material-symbols-outlined text-lg">videocam</span>
                                            View Clip
                                        </button>
                                        <button
                                            onClick={() => resolveAlert(alert.id)}
                                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-black transition-colors ${alert.type === 'critical' || alert.type === 'high'
                                                ? 'bg-[#22c55e] text-[#0a0f14] hover:bg-green-400'
                                                : 'bg-[#1c2632] border border-[#2a3441] text-[#94a3b8] hover:text-white'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-lg font-bold">check_circle</span>
                                            RESOLVE
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <footer className="flex-shrink-0 px-8 py-3 bg-[#1B2431] border-t border-[#2a3441] flex justify-between items-center text-xs text-[#94a3b8]">
                    <div className="flex gap-6">
                        <span className="flex items-center gap-1.5"><b className="text-white">128</b> Events Today</span>
                        <span className="flex items-center gap-1.5"><b className="text-[#22c55e]">98%</b> Resolution Rate</span>
                    </div>
                    <div>Page 1 of 12</div>
                </footer>
            </main>
        </div>
    );
}
