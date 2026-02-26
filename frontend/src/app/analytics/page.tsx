'use client';

import { useState } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import StatusDot from '@/components/ui/StatusDot';
import SegmentedControl from '@/components/ui/SegmentedControl';
import ProgressBar from '@/components/ui/ProgressBar';
import { analyticsData } from '@/lib/mockData';

type TimeFrame = '1h' | 'today' | '7d' | '30d';

const timeFrameOptions: { value: TimeFrame; label: string }[] = [
    { value: '1h', label: 'Last Hour' },
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
];

export default function AnalyticsPage() {
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('today');

    const multiplier = timeFrame === '1h' ? 0.04 : timeFrame === '7d' ? 7 : timeFrame === '30d' ? 30 : 1;
    const totalEvents = Math.round(analyticsData.totalEventsToday * multiplier);

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
                    {/* KPI row — first card 2x wide (asymmetric) */}
                    <div className="grid grid-cols-12 gap-4 shrink-0 stagger-children">
                        {/* Featured: Total detections — span 5 */}
                        <Card variant="featured" className="col-span-5 relative overflow-hidden group" hover>
                            <div className="absolute -top-4 -right-4 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
                                <span className="material-symbols-outlined text-[80px] text-accent">analytics</span>
                            </div>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Total Detections</p>
                            <div className="flex items-baseline gap-3">
                                <h2 className="text-4xl font-bold text-text-primary tracking-tight">{totalEvents.toLocaleString()}</h2>
                                <Badge variant="success">+{analyticsData.eventsChange}%</Badge>
                            </div>
                            <div className="mt-4 h-1 w-full bg-surface-3 rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full animate-bar-fill" style={{ width: '65%' }} />
                            </div>
                            <p className="text-[11px] text-text-tertiary mt-2">vs. previous period capacity</p>
                        </Card>

                        {/* Detection Accuracy — span 3 */}
                        <Card className="col-span-3 relative overflow-hidden group" hover>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Detection Accuracy</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-3xl font-bold text-text-primary">
                                    {analyticsData.avgConfidence}<span className="text-xl text-text-tertiary font-light">%</span>
                                </h2>
                                <Badge variant="warning">{analyticsData.confidenceChange}%</Badge>
                            </div>
                            <div className="mt-4 h-1 w-full bg-surface-3 rounded-full overflow-hidden">
                                <div className="h-full bg-success rounded-full animate-bar-fill" style={{ width: `${analyticsData.avgConfidence}%` }} />
                            </div>
                        </Card>

                        {/* Peak Occupancy — span 2 */}
                        <Card className="col-span-2 group" hover>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Peak</p>
                            <h2 className="text-2xl font-bold text-text-primary">{analyticsData.peakTime}</h2>
                            <p className="text-sm text-text-secondary mt-1">{analyticsData.peakOccupancy} people</p>
                            <p className="text-[11px] text-text-tertiary mt-1">{analyticsData.peakZone}</p>
                        </Card>

                        {/* Uptime — span 2 */}
                        <Card className="col-span-2 group" hover>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Uptime</p>
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-bold text-text-primary">
                                    {analyticsData.systemUptime}<span className="text-lg text-text-tertiary font-light">%</span>
                                </h2>
                                <div className="size-2 rounded-full bg-success animate-pulse shadow-[0_0_6px_var(--success)]" />
                            </div>
                            <p className="text-[11px] text-success font-medium mt-2">All nodes OK</p>
                        </Card>
                    </div>

                    {/* Section label */}
                    <div className="flex items-center gap-3 pt-1">
                        <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-widest">Trends</span>
                        <div className="flex-1 h-px bg-border-subtle" />
                    </div>

                    {/* Charts row — 2/3 + 1/3 */}
                    <div className="grid grid-cols-3 gap-5 flex-grow stagger-children" style={{ minHeight: 380 }}>
                        {/* Occupancy chart */}
                        <Card className="col-span-2 flex flex-col" padding="lg">
                            <div className="flex justify-between items-start mb-5">
                                <div>
                                    <h3 className="text-base font-bold text-text-primary">Occupancy Trends</h3>
                                    <p className="text-sm text-text-tertiary mt-0.5">Movement patterns across all zones</p>
                                </div>
                                <div className="flex gap-4">
                                    {[
                                        { color: 'bg-accent', label: 'Occupancy' },
                                        { color: 'bg-success', label: 'Ingress' },
                                        { color: 'bg-orange-500', label: 'Egress' },
                                    ].map(l => (
                                        <div key={l.label} className="flex items-center gap-1.5">
                                            <div className={`size-2 rounded-full ${l.color}`} />
                                            <span className="text-[11px] text-text-tertiary">{l.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-grow w-full relative">
                                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
                                    <defs>
                                        <linearGradient id="occGrad" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                                            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {[75, 150, 225].map(y => (
                                        <line key={y} stroke="var(--border-subtle)" x1="0" x2="1000" y1={y} y2={y} />
                                    ))}
                                    <path d="M0,250 L100,220 L200,180 L300,200 L400,140 L500,160 L600,100 L700,120 L800,80 L900,110 L1000,90 V300 H0 Z" fill="url(#occGrad)" />
                                    <path d="M0,250 L100,220 L200,180 L300,200 L400,140 L500,160 L600,100 L700,120 L800,80 L900,110 L1000,90" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
                                    <path d="M0,280 L100,260 L200,240 L300,250 L400,200 L500,210 L600,180 L700,190 L800,150 L900,170 L1000,160" fill="none" stroke="var(--success)" strokeWidth="1.5" strokeDasharray="6,4" />
                                    <path d="M0,290 L100,275 L200,260 L300,270 L400,235 L500,245 L600,220 L700,230 L800,200 L900,215 L1000,205" fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="6,4" />
                                </svg>
                                <div className="flex justify-between mt-3">
                                    {['00:00', '06:00', '12:00', '18:00', 'Now'].map(t => (
                                        <span key={t} className="text-[10px] text-text-tertiary font-mono">{t}</span>
                                    ))}
                                </div>
                            </div>
                        </Card>

                        {/* Alert distribution */}
                        <Card className="flex flex-col" padding="lg">
                            <h3 className="text-base font-bold text-text-primary">Incident Distribution</h3>
                            <p className="text-sm text-text-tertiary mt-0.5 mb-5">By category</p>

                            <div className="flex-grow flex items-center justify-center relative mb-5">
                                <div className="relative size-40 rounded-full border-[10px] border-surface-3 flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border-[10px] border-accent border-t-transparent border-l-transparent rotate-45" />
                                    <div className="absolute inset-0 rounded-full border-[10px] border-warning border-b-transparent border-r-transparent border-l-transparent -rotate-[15deg]" />
                                    <div className="absolute inset-0 rounded-full border-[10px] border-danger border-r-transparent border-b-transparent border-t-transparent rotate-180" />
                                    <div className="text-center">
                                        <span className="block text-2xl font-bold text-text-primary">1,240</span>
                                        <span className="text-[10px] uppercase text-text-tertiary font-medium tracking-wider">Total</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                {[
                                    { color: 'bg-warning', label: 'Loitering', data: analyticsData.alertDistribution.loitering },
                                    { color: 'bg-danger', label: 'Fall Detection', data: analyticsData.alertDistribution.fall },
                                    { color: 'bg-accent', label: 'Zone Breach', data: analyticsData.alertDistribution.areaBreach },
                                    { color: 'bg-text-tertiary', label: 'Other', data: analyticsData.alertDistribution.other },
                                ].map(item => (
                                    <div key={item.label} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <span className={`size-2.5 rounded-sm ${item.color}`} />
                                            <span className="text-[13px] text-text-secondary">{item.label}</span>
                                        </div>
                                        <span className="text-[13px] font-medium text-text-primary font-mono">
                                            {item.data.count} <span className="text-text-tertiary text-[11px]">({item.data.percentage}%)</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    {/* Section label */}
                    <div className="flex items-center gap-3 pt-1">
                        <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-widest">Breakdown</span>
                        <div className="flex-1 h-px bg-border-subtle" />
                    </div>

                    {/* Bottom row — 7/5 (intentional asymmetry) */}
                    <div className="grid grid-cols-12 gap-5 stagger-children">
                        {/* Hourly heatmap — span 7 */}
                        <Card className="col-span-7" padding="lg">
                            <h3 className="text-base font-bold text-text-primary">Hourly Activity</h3>
                            <p className="text-sm text-text-tertiary mt-0.5 mb-4">Peak hours analysis</p>
                            <div className="grid grid-cols-12 gap-1.5">
                                {Array.from({ length: 24 }, (_, i) => {
                                    const intensities = [0.15, 0.08, 0.05, 0.06, 0.12, 0.35, 0.55, 0.72, 0.85, 0.92, 0.88, 0.78, 0.82, 0.75, 0.68, 0.62, 0.7, 0.65, 0.45, 0.38, 0.3, 0.22, 0.18, 0.12];
                                    const intensity = intensities[i];
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-1">
                                            <div
                                                className="w-full aspect-square rounded-[3px] transition-colors hover:ring-1 hover:ring-accent/50"
                                                style={{ backgroundColor: `rgba(59, 130, 246, ${0.08 + intensity * 0.85})` }}
                                                title={`${i}:00 — ${Math.round(intensity * 100)}% activity`}
                                            />
                                            {i % 6 === 0 && (
                                                <span className="text-[9px] text-text-tertiary font-mono">{i}h</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex items-center justify-between mt-4">
                                <span className="text-[10px] text-text-tertiary">Low</span>
                                <div className="flex gap-0.5">
                                    {[0.1, 0.3, 0.5, 0.7, 0.9].map((op, i) => (
                                        <div key={i} className="w-5 h-2 rounded-sm" style={{ backgroundColor: `rgba(59, 130, 246, ${op})` }} />
                                    ))}
                                </div>
                                <span className="text-[10px] text-text-tertiary">High</span>
                            </div>
                        </Card>

                        {/* Behavior classification — span 5 */}
                        <Card className="col-span-5" padding="lg">
                            <h3 className="text-base font-bold text-text-primary">Behavior Classification</h3>
                            <p className="text-sm text-text-tertiary mt-0.5 mb-5">AI-detected distribution</p>
                            <div className="space-y-5">
                                {[
                                    { label: 'Walking', value: 68, color: 'var(--accent)' },
                                    { label: 'Standing', value: 24, color: 'var(--success)' },
                                    { label: 'Sitting', value: 5, color: '#a78bfa' },
                                    { label: 'Loitering', value: 3, color: 'var(--warning)' },
                                ].map((b) => (
                                    <ProgressBar key={b.label} label={b.label} value={b.value} color={b.color} />
                                ))}
                            </div>
                        </Card>
                    </div>
                </main>
            </div>
        </div>
    );
}
