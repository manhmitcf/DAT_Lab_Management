'use client';

import { useState } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import StatusDot from '@/components/ui/StatusDot';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { alerts } from '@/lib/mockData';

type FilterType = 'all' | 'critical' | 'warning' | 'info';

const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'critical', label: 'Critical' },
    { value: 'warning', label: 'Warning' },
    { value: 'info', label: 'Info' },
];

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function getDuration(start: string, end: string) {
    const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function AlertsPage() {
    const [filter, setFilter] = useState<FilterType>('all');

    const filteredAlerts = alerts.filter(a => filter === 'all' || a.type === filter);

    const getSeverityColor = (type: string) => {
        if (type === 'critical') return 'bg-danger';
        if (type === 'warning') return 'bg-orange-500';
        return 'bg-accent';
    };

    const getSeverityBg = (type: string) => {
        if (type === 'critical') return 'bg-danger-muted';
        if (type === 'warning') return 'bg-warning-muted';
        return 'bg-surface-2';
    };

    const getSeverityIcon = (type: string) => {
        if (type === 'critical') return 'error';
        if (type === 'warning') return 'warning';
        return 'info';
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
                            <Badge variant="danger">{alerts.length} Total</Badge>
                        </div>

                        <div className="h-5 w-px bg-border-subtle" />

                        <SegmentedControl
                            options={filterOptions}
                            value={filter}
                            onChange={setFilter}
                        />
                    </div>

                    <StatusDot status="online" label="System Online" />
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
                                                alert.type === 'warning' ? 'bg-orange-500/15' : 'bg-accent/15'}
                                        `}>
                                            <span className={`material-symbols-outlined text-2xl ${alert.type === 'critical' ? 'text-danger' :
                                                alert.type === 'warning' ? 'text-orange-400' : 'text-accent'
                                                }`}>
                                                {getSeverityIcon(alert.type)}
                                            </span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2.5 mb-1">
                                                <h3 className="text-[15px] font-bold text-text-primary">{alert.event}</h3>
                                                <Badge variant={
                                                    alert.type === 'critical' ? 'danger' :
                                                        alert.type === 'warning' ? 'warning' : 'neutral'
                                                }>
                                                    {alert.type}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-text-secondary text-sm">
                                                <span className="font-mono text-text-tertiary text-xs">{formatDate(alert.start_time)}</span>
                                                <span className="text-text-tertiary">·</span>
                                                <span className="font-mono text-xs">{formatTime(alert.start_time)} — {formatTime(alert.end_time)}</span>
                                                <span className="text-text-tertiary">·</span>
                                                <span className="text-xs text-text-tertiary">Duration: <b className="text-text-secondary">{getDuration(alert.start_time, alert.end_time)}</b></span>
                                            </div>
                                        </div>

                                        {/* Actions — visible on hover */}
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--duration-fast)]">
                                            <Button icon="videocam" variant="secondary" size="sm">Video</Button>
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
                        <span className="flex items-center gap-1.5"><b className="text-text-primary font-semibold">{alerts.length}</b> Total Alerts</span>
                        <span className="flex items-center gap-1.5"><b className="text-danger font-semibold">{alerts.filter(a => a.type === 'critical').length}</b> Critical</span>
                        <span className="flex items-center gap-1.5"><b className="text-orange-400 font-semibold">{alerts.filter(a => a.type === 'warning').length}</b> Warning</span>
                    </div>
                    <div className="text-text-tertiary font-mono">DAT Lab</div>
                </footer>
            </main>
        </div>
    );
}
