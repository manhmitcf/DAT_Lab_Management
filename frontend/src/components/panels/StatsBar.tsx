import Link from 'next/link';
import { useTrackingStore } from '@/stores/trackingStore';
import MetricCard from '@/components/ui/MetricCard';

export default function StatsBar() {
    const stats = useTrackingStore((state) => state.stats);

    return (
        <div className="flex items-center divide-x divide-border-subtle h-full">
            <div className="px-5 py-2">
                <MetricCard label="Occupancy" icon="groups" iconColor="text-success">
                    <span className="text-base font-mono">{stats.person_count}</span>
                    <span className="text-success text-[10px] ml-1.5 font-mono">+{stats.person_count_change}%</span>
                </MetricCard>
            </div>

            <div className="px-5 py-2">
                <MetricCard label="Entry / Exit" icon="swap_horiz" iconColor="text-accent-strong">
                    <span className="text-success text-base font-mono">{stats.entry_today}</span>
                    <span className="text-text-tertiary mx-1">/</span>
                    <span className="text-orange-400 text-base font-mono">{stats.exit_today}</span>
                </MetricCard>
            </div>

            <div className="px-5 py-2">
                <MetricCard label="FPS" icon="speed" iconColor="text-purple-400">
                    <span className="text-base font-mono">{stats.fps}</span>
                </MetricCard>
            </div>

            <Link href="/alerts" className="px-5 py-2 hover:bg-surface-2 transition-colors group">
                <MetricCard label="Alerts" icon="warning" iconColor="text-danger">
                    <span className="text-base font-mono text-danger">5</span>
                    <span className="text-danger text-[9px] ml-1.5 uppercase font-bold tracking-wider">Live</span>
                </MetricCard>
            </Link>
        </div>
    );
}
