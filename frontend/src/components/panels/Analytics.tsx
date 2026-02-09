'use client';

import { useTrackingStore } from '@/stores/trackingStore';

export default function Analytics() {
    const stats = useTrackingStore((state) => state.stats);

    return (
        <>
            <div className="p-4 border-b border-[#283039] flex justify-between items-center bg-[#1a2027]/30">
                <div>
                    <h3 className="text-white text-sm font-bold uppercase tracking-tight">Analytics</h3>
                    <p className="text-gray-500 text-[9px] mt-0.5 uppercase">Real-time Performance</p>
                </div>
                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 8c-1.45 0-2.26 1.44-1.93 2.51l-3.55 3.56c-.3-.09-.74-.09-1.04 0l-2.55-2.55C12.27 10.45 11.46 9 10 9c-1.45 0-2.27 1.44-1.93 2.52l-4.56 4.55C2.44 15.74 1 16.55 1 18c0 1.1.9 2 2 2 1.45 0 2.26-1.44 1.93-2.51l4.55-4.56c.3.09.74.09 1.04 0l2.55 2.55C12.73 16.55 13.54 18 15 18c1.45 0 2.27-1.44 1.93-2.52l3.56-3.55c1.07.33 2.51-.48 2.51-1.93 0-1.1-.9-2-2-2z" />
                    <path d="M15 9l.94-2.07L18 6l-2.06-.93L15 3l-.92 2.07L12 6l2.08.93zM3.5 11L4 9l2-.5L4 8l-.5-2L3 8l-2 .5L3 9z" />
                </svg>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#1a2027] border border-[#283039] p-3 rounded-lg">
                        <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">Active Cameras</p>
                        <div className="flex items-end gap-2">
                            <span className="text-lg font-bold text-white leading-none">{stats.active_cameras}</span>
                            <span className="text-[10px] text-green-500 font-mono mb-0.5">ONLINE</span>
                        </div>
                    </div>
                    <div className="bg-[#1a2027] border border-[#283039] p-3 rounded-lg">
                        <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">Person Count</p>
                        <div className="flex items-end gap-2">
                            <span className="text-lg font-bold text-[#137fec] leading-none">{stats.person_count}</span>
                            <span className="text-[10px] text-[#137fec]/70 font-mono mb-0.5">
                                +{stats.person_count_change}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Behavior Distribution */}
                <div>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                        <span className="size-1.5 bg-[#137fec] rounded-full"></span>
                        Behavior Distribution
                    </h4>
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-300">WALKING</span>
                                <span className="text-white font-mono">{stats.behavior_distribution.walking}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-[#1a2027] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[#137fec]"
                                    style={{ width: `${stats.behavior_distribution.walking}%` }}
                                ></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-300">STANDING</span>
                                <span className="text-white font-mono">{stats.behavior_distribution.standing}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-[#1a2027] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[#137fec]/60"
                                    style={{ width: `${stats.behavior_distribution.standing}%` }}
                                ></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-300">LOITERING</span>
                                <span className="text-white font-mono">{stats.behavior_distribution.loitering}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-[#1a2027] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[#f59e0b]"
                                    style={{ width: `${stats.behavior_distribution.loitering}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Throughput */}
                <div className="pt-4 border-t border-[#283039]">
                    <p className="text-[9px] text-gray-500 uppercase font-bold mb-2">System Throughput</p>
                    <div className="h-16 flex items-end gap-1">
                        {stats.throughput.map((value, index) => (
                            <div
                                key={index}
                                className={`flex-1 rounded-t-sm ${value > 90 ? 'bg-[#ef4444]/40' :
                                        value > 60 ? 'bg-[#137fec]/60' :
                                            value > 40 ? 'bg-[#137fec]/40' : 'bg-[#137fec]/20'
                                    }`}
                                style={{ height: `${value}%` }}
                            ></div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
