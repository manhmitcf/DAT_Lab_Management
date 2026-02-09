'use client';

import Link from 'next/link';
import { useTrackingStore } from '@/stores/trackingStore';
import { alerts } from '@/lib/mockData';

export default function StatsBar() {
    const stats = useTrackingStore((state) => state.stats);
    const activeAlerts = alerts.filter(a => !a.resolved);

    return (
        <div className="flex items-center gap-3 px-6 py-3 bg-[#1B2431]/50 border-b border-[#2a3441]">
            {/* Real-time Occupancy */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[#1B2431] rounded-lg border border-[#2a3441]">
                <div className="size-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-400 text-lg">groups</span>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">Real-time Occupancy</p>
                    <p className="text-white font-bold text-sm">
                        {stats.person_count}
                        <span className="text-emerald-400 text-[10px] ml-1">+{stats.person_count_change}%</span>
                    </p>
                </div>
            </div>

            {/* Ingress / Egress Flow */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[#1B2431] rounded-lg border border-[#2a3441]">
                <div className="size-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-400 text-lg">swap_horiz</span>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">Ingress / Egress</p>
                    <p className="text-white font-bold text-sm">
                        <span className="text-emerald-400">{stats.entry_today}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-orange-400">{stats.exit_today}</span>
                    </p>
                </div>
            </div>

            {/* Active Sensors */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[#1B2431] rounded-lg border border-[#2a3441]">
                <div className="size-8 rounded-lg bg-[#137fec]/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#137fec] text-lg">sensors</span>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">Active Sensors</p>
                    <p className="text-white font-bold text-sm">
                        {stats.active_cameras}<span className="text-slate-500 font-normal">/{stats.total_cameras}</span>
                    </p>
                </div>
            </div>

            {/* Active Alerts */}
            <Link
                href="/alerts"
                className="flex items-center gap-3 px-4 py-2 bg-[#1B2431] rounded-lg border border-[#2a3441] hover:border-red-500/50 transition-colors group"
            >
                <div className="size-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-red-500 text-lg">warning</span>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">Active Alerts</p>
                    <p className="text-white font-bold text-sm">
                        {activeAlerts.length}
                        <span className="text-red-500 text-[10px] ml-1">LIVE</span>
                    </p>
                </div>
            </Link>

            {/* Inference Latency */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[#1B2431] rounded-lg border border-[#2a3441]">
                <div className="size-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-400 text-lg">speed</span>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">Inference Latency</p>
                    <p className="text-white font-bold text-sm">{stats.inference_time}ms</p>
                </div>
            </div>

            {/* Spacer */}
            <div className="flex-1"></div>

            {/* System Status */}
            <div className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-slate-400 font-medium">System Online</span>
            </div>
        </div>
    );
}
