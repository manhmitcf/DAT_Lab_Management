'use client';

import Link from 'next/link';
import { useTrackingStore } from '@/stores/trackingStore';
import { alerts } from '@/lib/mockData';

export default function StatsBar() {
    const stats = useTrackingStore((state) => state.stats);
    const activeAlerts = alerts.filter(a => !a.resolved);

    return (
        <div className="flex items-center gap-4 px-6 py-3 bg-[#1B2431]/50 border-b border-[#2a3441]">
            {/* Active Cameras */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[#1B2431] rounded-lg border border-[#2a3441]">
                <div className="size-8 rounded-lg bg-[#137fec]/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#137fec] text-lg">videocam</span>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Cameras</p>
                    <p className="text-white font-bold text-sm">
                        {stats.active_cameras}<span className="text-slate-500 font-normal">/{stats.total_cameras}</span>
                    </p>
                </div>
            </div>

            {/* Person Count */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[#1B2431] rounded-lg border border-[#2a3441]">
                <div className="size-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-400 text-lg">group</span>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Tracking</p>
                    <p className="text-white font-bold text-sm">
                        {stats.person_count}
                        <span className="text-green-500 text-[10px] ml-1">+{stats.person_count_change}%</span>
                    </p>
                </div>
            </div>

            {/* Active Alerts */}
            <Link
                href="/alerts"
                className="flex items-center gap-3 px-4 py-2 bg-[#1B2431] rounded-lg border border-[#2a3441] hover:border-red-500/50 transition-colors group"
            >
                <div className="size-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-red-500 text-lg">notifications_active</span>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Alerts</p>
                    <p className="text-white font-bold text-sm">
                        {activeAlerts.length}
                        <span className="text-red-500 text-[10px] ml-1">ACTIVE</span>
                    </p>
                </div>
            </Link>

            {/* Inference Time */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[#1B2431] rounded-lg border border-[#2a3441]">
                <div className="size-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-green-500 text-lg">speed</span>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Inference</p>
                    <p className="text-white font-bold text-sm">{stats.inference_time}ms</p>
                </div>
            </div>

            {/* Spacer */}
            <div className="flex-1"></div>

            {/* View Analytics Link */}
            <Link
                href="/analytics"
                className="flex items-center gap-2 px-4 py-2 text-[#137fec] hover:text-white hover:bg-[#137fec] rounded-lg transition-colors text-sm font-medium"
            >
                <span className="material-symbols-outlined text-lg">analytics</span>
                View Analytics
            </Link>
        </div>
    );
}
