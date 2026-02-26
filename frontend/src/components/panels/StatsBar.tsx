'use client';

import Link from 'next/link';
import { useTrackingStore } from '@/stores/trackingStore';
import { alerts } from '@/lib/mockData';
import MetricCard from '@/components/ui/MetricCard';
import StatusDot from '@/components/ui/StatusDot';

export default function StatsBar() {
    const stats = useTrackingStore((state) => state.stats);
    const activeAlerts = alerts.filter(a => !a.resolved);

    return (
        <div className="flex items-center gap-px bg-surface-1 border-b border-border-default animate-fade-in">
            {/* Metrics strip */}
            <div className="flex items-center divide-x divide-border-subtle flex-1">
                <div className="px-5 py-2.5">
                    <MetricCard label="Occupancy" icon="groups" iconColor="text-success">
                        <span>{stats.person_count}</span>
                        <span className="text-success text-[10px] ml-1.5 font-mono">+{stats.person_count_change}%</span>
                    </MetricCard>
                </div>

                <div className="px-5 py-2.5">
                    <MetricCard label="Ingress / Egress" icon="swap_horiz" iconColor="text-accent-strong">
                        <span className="text-success font-mono">{stats.entry_today}</span>
                        <span className="text-text-tertiary mx-1">/</span>
                        <span className="text-orange-400 font-mono">{stats.exit_today}</span>
                    </MetricCard>
                </div>

                <div className="px-5 py-2.5">
                    <MetricCard label="Sensors" icon="sensors" iconColor="text-accent">
                        <span>{stats.active_cameras}</span>
                        <span className="text-text-tertiary font-normal">/{stats.total_cameras}</span>
                    </MetricCard>
                </div>

                <Link href="/alerts" className="px-5 py-2.5 hover:bg-surface-2 transition-colors group">
                    <MetricCard label="Alerts" icon="warning" iconColor="text-danger">
                        <span>{activeAlerts.length}</span>
                        <span className="text-danger text-[10px] ml-1.5 uppercase font-bold tracking-wider">Live</span>
                    </MetricCard>
                </Link>

                <div className="px-5 py-2.5">
                    <MetricCard label="Latency" icon="speed" iconColor="text-purple-400">
                        <span className="font-mono">{stats.inference_time}<span className="text-text-tertiary text-[10px] ml-0.5">ms</span></span>
                    </MetricCard>
                </div>
            </div>

            {/* System status */}
            <div className="px-5 py-2.5 shrink-0">
                <StatusDot status="online" label="System Online" />
            </div>
        </div>
    );
}
