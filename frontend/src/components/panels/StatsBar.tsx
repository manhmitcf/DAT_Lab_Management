'use client';

import Link from 'next/link';
import { useTrackingStore } from '@/stores/trackingStore';
import MetricCard from '@/components/ui/MetricCard';
import StatusDot from '@/components/ui/StatusDot';

export default function StatsBar() {
    const stats = useTrackingStore((state) => state.stats);

    return (
        <div className="flex items-center gap-px bg-surface-1 border-b border-border-default animate-fade-in">
            {/* Metrics strip — larger padding for readability */}
            <div className="flex items-center divide-x divide-border-subtle flex-1">
                <div className="px-6 py-4">
                    <MetricCard label="Occupancy" icon="groups" iconColor="text-success">
                        <span className="text-lg">{stats.person_count}</span>
                        <span className="text-success text-xs ml-2 font-mono">+{stats.person_count_change}%</span>
                    </MetricCard>
                </div>

                <div className="px-6 py-4">
                    <MetricCard label="Ingress / Egress" icon="swap_horiz" iconColor="text-accent-strong">
                        <span className="text-success text-lg font-mono">{stats.entry_today}</span>
                        <span className="text-text-tertiary mx-1.5">/</span>
                        <span className="text-orange-400 text-lg font-mono">{stats.exit_today}</span>
                    </MetricCard>
                </div>

                <div className="px-6 py-4">
                    <MetricCard label="FPS" icon="speed" iconColor="text-purple-400">
                        <span className="text-lg font-mono">30</span>
                    </MetricCard>
                </div>

                <Link href="/alerts" className="px-6 py-4 hover:bg-surface-2 transition-colors group">
                    <MetricCard label="Alerts" icon="warning" iconColor="text-danger">
                        <span className="text-lg">5</span>
                        <span className="text-danger text-xs ml-2 uppercase font-bold tracking-wider">Live</span>
                    </MetricCard>
                </Link>
            </div>

            {/* System status */}
            <div className="px-6 py-4 shrink-0">
                <StatusDot status="online" label="System Online" />
            </div>
        </div>
    );
}
