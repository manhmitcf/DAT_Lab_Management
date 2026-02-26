'use client';

import { useState } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import StatusDot from '@/components/ui/StatusDot';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { alerts } from '@/lib/mockData';

type FilterType = 'all' | 'falls' | 'intrusions' | 'fighting';

const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All Events' },
    { value: 'falls', label: 'Falls' },
    { value: 'intrusions', label: 'Intrusions' },
    { value: 'fighting', label: 'Fighting' },
];

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

    const getSeverityColor = (type: string) => {
        if (type === 'critical') return 'bg-danger';
        if (type === 'high') return 'bg-orange-500';
        return 'bg-text-tertiary';
    };

    const getSeverityBg = (type: string) => {
        if (type === 'critical') return 'bg-danger-muted';
        if (type === 'high') return 'bg-warning-muted';
        return 'bg-surface-2';
    };

    return (
        <div className="flex h-screen w-full bg-surface-0">
            <MainSidebar />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Toolbar */}
                <div className="px-6 py-3.5 bg-surface-1 border-b border-border-default flex items-center justify-between gap-4 animate-fade-in">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-danger text-xl">warning</span>
                            <h1 className="text-lg font-bold text-text-primary tracking-tight">Alert Management</h1>
                            <Badge variant="danger">{activeAlerts.length} Active</Badge>
                        </div>

                        <div className="h-5 w-px bg-border-subtle" />

                        <SegmentedControl
                            options={filterOptions}
                            value={filter}
                            onChange={setFilter}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative w-56">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-surface-0 border border-border-default rounded-[var(--radius-md)] pl-9 pr-4 py-2 text-sm text-text-primary focus:ring-1 focus:ring-accent focus:border-accent placeholder:text-text-tertiary transition-colors"
                                placeholder="Search alerts..."
                            />
                        </div>
                        <StatusDot status="online" label="System Online" />
                    </div>
                </div>

                {/* Timeline feed */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto pl-12 pr-6 py-4 relative stagger-children">
                        {/* Vertical timeline line */}
                        <div className="absolute left-[42px] top-0 bottom-0 w-px bg-border-default" />

                        {filteredAlerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <span className="material-symbols-outlined text-5xl text-text-tertiary mb-3">filter_alt_off</span>
                                <p className="text-text-secondary text-sm">No alerts match your filter.</p>
                                <p className="text-text-tertiary text-xs mt-1">Try adjusting your search or filter criteria.</p>
                            </div>
                        ) : (
                            filteredAlerts.map((alert) => (
                                <div key={alert.id} className="relative flex gap-5 mb-3 group">
                                    {/* Timeline node */}
                                    <div className="absolute left-[-18px] top-5 z-10">
                                        <div className={`size-3 rounded-full ring-4 ring-surface-0 ${getSeverityColor(alert.type)}`} />
                                    </div>

                                    {/* Alert card */}
                                    <div className={`
                                        flex-1 flex items-center gap-5 px-5 py-4 rounded-[var(--radius-lg)]
                                        border border-border-default
                                        transition-all duration-[var(--duration-fast)]
                                        hover:border-border-strong hover:shadow-md
                                        ${getSeverityBg(alert.type)}
                                    `}>
                                        {/* Icon */}
                                        <div className={`
                                            shrink-0 size-11 rounded-[var(--radius-md)] flex items-center justify-center
                                            ${alert.type === 'critical' ? 'bg-danger/20' :
                                                alert.type === 'high' ? 'bg-orange-500/15' : 'bg-surface-3'}
                                        `}>
                                            <span className={`material-symbols-outlined text-2xl ${alert.type === 'critical' ? 'text-danger' :
                                                    alert.type === 'high' ? 'text-orange-400' : 'text-text-secondary'
                                                }`}>
                                                {alert.icon}
                                            </span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2.5 mb-1">
                                                <h3 className="text-[15px] font-bold text-text-primary">{alert.event}</h3>
                                                <Badge variant={
                                                    alert.type === 'critical' ? 'danger' :
                                                        alert.type === 'high' ? 'warning' : 'neutral'
                                                }>
                                                    {alert.type}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-text-secondary text-sm">
                                                <span>{alert.camera}</span>
                                                <span className="text-text-tertiary">·</span>
                                                <span>{alert.location}</span>
                                                <span className="text-text-tertiary">·</span>
                                                <span className="font-mono text-text-tertiary text-xs">{alert.timestamp}</span>
                                                <span className="text-text-tertiary">·</span>
                                                <span className="text-text-tertiary text-xs">{(alert.confidence * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>

                                        {/* Actions — visible on hover */}
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--duration-fast)]">
                                            <Button icon="videocam" variant="secondary" size="sm">Clip</Button>
                                            <Button
                                                icon="check_circle"
                                                variant={alert.type === 'critical' || alert.type === 'high' ? 'primary' : 'ghost'}
                                                size="sm"
                                            >
                                                Resolve
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <footer className="shrink-0 px-6 py-2.5 bg-surface-1 border-t border-border-default flex justify-between items-center text-xs text-text-secondary">
                    <div className="flex gap-6">
                        <span className="flex items-center gap-1.5"><b className="text-text-primary font-semibold">128</b> Events Today</span>
                        <span className="flex items-center gap-1.5"><b className="text-success font-semibold">98%</b> Resolution Rate</span>
                    </div>
                    <div className="text-text-tertiary font-mono">Page 1 of 12</div>
                </footer>
            </main>
        </div>
    );
}
