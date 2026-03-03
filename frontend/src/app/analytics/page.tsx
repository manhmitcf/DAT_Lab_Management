'use client';

import { useState } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import StatusDot from '@/components/ui/StatusDot';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { analyticsData } from '@/lib/mockData';

type TimeFrame = '1h' | 'today' | '7d' | '30d';

const timeFrameOptions: { value: TimeFrame; label: string }[] = [
    { value: '1h', label: 'Last Hour' },
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
];

const { summary, occupancyTrends, heatmap, trafficDaily, flowRatio } = analyticsData;

export default function AnalyticsPage() {
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('today');

    // Generate SVG path from occupancy trend data
    const maxOcc = Math.max(...occupancyTrends.current.map(d => d.occupancy));
    const trendToPath = (data: typeof occupancyTrends.current) => {
        return data.map((d, i) => {
            const x = (i / (data.length - 1)) * 1000;
            const y = 280 - (d.occupancy / maxOcc) * 250;
            return `${i === 0 ? 'M' : 'L'}${x},${y}`;
        }).join(' ');
    };
    const currentPath = trendToPath(occupancyTrends.current);
    const previousPath = trendToPath(occupancyTrends.previous);
    const areaPath = currentPath + ' L1000,280 L0,280 Z';

    // Traffic bar chart max
    const maxTraffic = Math.max(...trafficDaily.map(d => Math.max(d.total_in, d.total_out)));

    return (
        <div className="flex h-screen w-full bg-surface-0">
            <MainSidebar />

            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                {/* Toolbar */}
                <div className="px-6 py-3.5 bg-surface-1 border-b border-border-default flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-accent text-xl">analytics</span>
                            <h1 className="text-lg font-bold text-text-primary tracking-tight">Analytics</h1>
                        </div>
                        <div className="h-5 w-px bg-border-subtle" />
                        <SegmentedControl
                            options={timeFrameOptions}
                            value={timeFrame}
                            onChange={setTimeFrame}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Button icon="download" variant="secondary" size="sm">Export</Button>
                        <StatusDot status="online" label="Real-time sync" />
                    </div>
                </div>

                {/* Content */}
                <main className="flex-grow flex flex-col p-5 gap-5 overflow-y-auto">
                    {/* ====== TOP ROW: KPI Cards ====== */}
                    <div className="grid grid-cols-4 gap-4 shrink-0 stagger-children">
                        {/* Current Occupancy — featured */}
                        <Card variant="featured" className="relative overflow-hidden group" hover>
                            <div className="absolute -top-4 -right-4 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
                                <span className="material-symbols-outlined text-[80px] text-accent">groups</span>
                            </div>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Current Occupancy</p>
                            <h2 className="text-4xl font-bold text-text-primary tracking-tight">{summary.current_occupancy}</h2>
                            <p className="text-[11px] text-text-tertiary mt-2">people in lab right now</p>
                        </Card>

                        {/* Peak Hour */}
                        <Card className="group" hover>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Peak Hour</p>
                            <h2 className="text-2xl font-bold text-text-primary">{summary.peak_time}</h2>
                            <p className="text-sm text-text-secondary mt-1">{summary.peak_occupancy} people</p>
                            <div className="mt-3 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-warning text-sm">trending_up</span>
                                <span className="text-[11px] text-warning font-medium">Highest today</span>
                            </div>
                        </Card>

                        {/* Avg Dwell Time */}
                        <Card className="group" hover>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Avg Dwell Time</p>
                            <div className="flex items-baseline gap-1">
                                <h2 className="text-2xl font-bold text-text-primary">{summary.avg_dwell_time_minutes}</h2>
                                <span className="text-lg text-text-tertiary font-light">min</span>
                            </div>
                            <div className="mt-3 h-1 w-full bg-surface-3 rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full animate-bar-fill" style={{ width: `${Math.min((summary.avg_dwell_time_minutes / 60) * 100, 100)}%` }} />
                            </div>
                        </Card>

                        {/* Net Flow */}
                        <Card className="group" hover>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Net Flow</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-2xl font-bold text-success">+{summary.net_flow}</h2>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-[11px]">
                                <span className="text-success font-mono">▲ {summary.total_in} in</span>
                                <span className="text-orange-400 font-mono">▼ {summary.total_out} out</span>
                            </div>
                        </Card>
                    </div>

                    {/* ====== MIDDLE ROW: Line Chart + Donut ====== */}
                    <div className="flex items-center gap-3 pt-1">
                        <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-widest">Trends</span>
                        <div className="flex-1 h-px bg-border-subtle" />
                    </div>

                    <div className="grid grid-cols-3 gap-5 stagger-children" style={{ minHeight: 360 }}>
                        {/* Occupancy Trend Line Chart */}
                        <Card className="col-span-2 flex flex-col" padding="lg">
                            <div className="flex justify-between items-start mb-5">
                                <div>
                                    <h3 className="text-base font-bold text-text-primary">Occupancy Trends</h3>
                                    <p className="text-sm text-text-tertiary mt-0.5">Today vs previous period</p>
                                </div>
                                <div className="flex gap-4">
                                    {[
                                        { color: 'bg-accent', label: 'Today', style: 'solid' },
                                        { color: 'bg-accent/40', label: 'Yesterday', style: 'dashed' },
                                    ].map(l => (
                                        <div key={l.label} className="flex items-center gap-1.5">
                                            <div className={`w-4 h-0.5 rounded ${l.color} ${l.style === 'dashed' ? 'border-t border-dashed border-accent/40' : ''}`} />
                                            <span className="text-[11px] text-text-tertiary">{l.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-grow w-full relative">
                                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
                                    <defs>
                                        <linearGradient id="occGrad" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {[70, 140, 210].map(y => (
                                        <line key={y} stroke="var(--border-subtle)" x1="0" x2="1000" y1={y} y2={y} />
                                    ))}
                                    <path d={areaPath} fill="url(#occGrad)" />
                                    <path d={currentPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
                                    <path d={previousPath} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.35" />
                                </svg>
                                <div className="flex justify-between mt-3">
                                    {occupancyTrends.current.filter((_, i) => i % 2 === 0).map(d => (
                                        <span key={d.time} className="text-[10px] text-text-tertiary font-mono">{d.time}</span>
                                    ))}
                                </div>
                            </div>
                        </Card>

                        {/* Entry/Exit Donut + Dwell Distribution */}
                        <Card className="flex flex-col" padding="lg">
                            <h3 className="text-base font-bold text-text-primary">Flow Ratio</h3>
                            <p className="text-sm text-text-tertiary mt-0.5 mb-4">Entry vs Exit</p>

                            <div className="flex items-center justify-center relative mb-4">
                                <div className="relative size-36">
                                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--surface-3)" strokeWidth="10" />
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--success)" strokeWidth="10"
                                            strokeDasharray={`${flowRatio.entry_exit.in_percentage * 2.51} ${100 * 2.51}`} />
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="#f97316" strokeWidth="10"
                                            strokeDasharray={`${flowRatio.entry_exit.out_percentage * 2.51} ${100 * 2.51}`}
                                            strokeDashoffset={`-${flowRatio.entry_exit.in_percentage * 2.51}`} />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-lg font-bold text-text-primary">{summary.total_in + summary.total_out}</span>
                                        <span className="text-[9px] text-text-tertiary uppercase tracking-wider">Total</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center gap-6 mb-5">
                                <div className="flex items-center gap-1.5">
                                    <div className="size-2.5 rounded-sm bg-success" />
                                    <span className="text-[12px] text-text-secondary">In {flowRatio.entry_exit.in_percentage}%</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="size-2.5 rounded-sm bg-orange-500" />
                                    <span className="text-[12px] text-text-secondary">Out {flowRatio.entry_exit.out_percentage}%</span>
                                </div>
                            </div>

                            <div className="border-t border-border-subtle pt-4">
                                <p className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium mb-3">Dwell Distribution</p>
                                <div className="space-y-2">
                                    {flowRatio.dwell_distribution.map(d => (
                                        <div key={d.range} className="flex items-center gap-3">
                                            <span className="text-[11px] text-text-secondary w-16 shrink-0">{d.range}</span>
                                            <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                                                <div className="h-full bg-accent/60 rounded-full transition-all" style={{ width: `${d.percentage}%` }} />
                                            </div>
                                            <span className="text-[11px] text-text-primary font-mono w-8 text-right">{d.percentage}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* ====== BOTTOM ROW: Heatmap + Traffic Bar ====== */}
                    <div className="flex items-center gap-3 pt-1">
                        <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-widest">Breakdown</span>
                        <div className="flex-1 h-px bg-border-subtle" />
                    </div>

                    <div className="grid grid-cols-12 gap-5 stagger-children">
                        {/* 24h×7d Heatmap — span 7 */}
                        <Card className="col-span-7" padding="lg">
                            <h3 className="text-base font-bold text-text-primary">Weekly Heatmap</h3>
                            <p className="text-sm text-text-tertiary mt-0.5 mb-4">24h × 7 days activity pattern</p>
                            <div className="space-y-1">
                                {heatmap.map(row => (
                                    <div key={row.day} className="flex items-center gap-2">
                                        <span className="text-[10px] text-text-tertiary font-mono w-7 shrink-0">{row.day}</span>
                                        <div className="flex gap-[2px] flex-1">
                                            {row.hours.map((intensity, h) => (
                                                <div
                                                    key={h}
                                                    className="flex-1 aspect-square rounded-[2px] hover:ring-1 hover:ring-accent/50 transition-all cursor-crosshair"
                                                    style={{ backgroundColor: `rgba(59, 130, 246, ${0.06 + intensity * 0.88})` }}
                                                    title={`${row.day} ${h}:00 — ${Math.round(intensity * 100)}%`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Hour labels */}
                            <div className="flex mt-2 ml-9">
                                {[0, 4, 8, 12, 16, 20].map(h => (
                                    <span key={h} className="text-[9px] text-text-tertiary font-mono" style={{ marginLeft: h === 0 ? 0 : `${(4 / 24) * 100}%` }}>{h}h</span>
                                ))}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <span className="text-[10px] text-text-tertiary">Low</span>
                                <div className="flex gap-0.5">
                                    {[0.1, 0.3, 0.5, 0.7, 0.9].map((op, i) => (
                                        <div key={i} className="w-5 h-2 rounded-sm" style={{ backgroundColor: `rgba(59, 130, 246, ${op})` }} />
                                    ))}
                                </div>
                                <span className="text-[10px] text-text-tertiary">High</span>
                            </div>
                        </Card>

                        {/* Daily Traffic Bar Chart — span 5 */}
                        <Card className="col-span-5" padding="lg">
                            <h3 className="text-base font-bold text-text-primary">Daily Traffic</h3>
                            <p className="text-sm text-text-tertiary mt-0.5 mb-4">Entry vs Exit by day</p>
                            <div className="flex items-end gap-3 flex-grow" style={{ minHeight: 200 }}>
                                {trafficDaily.map(d => (
                                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                                        <div className="w-full flex gap-[2px] justify-center" style={{ height: 180 }}>
                                            <div className="flex flex-col justify-end w-[45%]">
                                                <div
                                                    className="bg-success/70 rounded-t-sm hover:bg-success transition-colors"
                                                    style={{ height: `${(d.total_in / maxTraffic) * 100}%` }}
                                                    title={`In: ${d.total_in}`}
                                                />
                                            </div>
                                            <div className="flex flex-col justify-end w-[45%]">
                                                <div
                                                    className="bg-orange-500/60 rounded-t-sm hover:bg-orange-500 transition-colors"
                                                    style={{ height: `${(d.total_out / maxTraffic) * 100}%` }}
                                                    title={`Out: ${d.total_out}`}
                                                />
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-text-tertiary font-mono">{d.day}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-border-subtle">
                                <div className="flex items-center gap-1.5">
                                    <div className="size-2.5 rounded-sm bg-success/70" />
                                    <span className="text-[11px] text-text-secondary">Entry</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="size-2.5 rounded-sm bg-orange-500/60" />
                                    <span className="text-[11px] text-text-secondary">Exit</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </main>
            </div>
        </div>
    );
}
