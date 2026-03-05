'use client';

import { useState, useCallback, useRef } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import StatusDot from '@/components/ui/StatusDot';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { analyticsData } from '@/lib/mockData';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

type TimeFrame = '1h' | 'today' | '7d' | '30d';

const timeFrameOptions: { value: TimeFrame; label: string }[] = [
    { value: '1h', label: 'Last Hour' },
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
];

const { summary, occupancyTrends, heatmap, trafficDaily, flowRatio, peakDaily, cumulativeTraffic, dwellByHour } = analyticsData;

// ── SVG helpers ──────────────────────────────────────────────────────────
function dataToPath(data: { occupancy: number }[], maxVal: number) {
    return data.map((d, i) => {
        const x = (i / (data.length - 1)) * 1000;
        const y = 260 - (d.occupancy / maxVal) * 230;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
}

export default function AnalyticsPage() {
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('today');
    const [isExporting, setIsExporting] = useState(false);
    const reportRef = useRef<HTMLElement>(null);

    // ── Export CSV ────────────────────────────────────────────────────────
    const handleExportCSV = useCallback(() => {
        const lines: string[] = [];
        const now = new Date().toLocaleString();
        lines.push(`EdgeSentinelAI Analytics Report`);
        lines.push(`Generated: ${now}`);
        lines.push(`Period: ${timeFrame}`);
        lines.push('');

        // KPI Summary
        lines.push('=== KPI Summary ===');
        lines.push(`Current Occupancy,${summary.current_occupancy}`);
        lines.push(`Peak Occupancy,${summary.peak_occupancy}`);
        lines.push(`Peak Time,${summary.peak_time}`);
        lines.push(`Avg Dwell Time (min),${summary.avg_dwell_time_minutes}`);
        lines.push(`Total In,${summary.total_in}`);
        lines.push(`Total Out,${summary.total_out}`);
        lines.push(`Net Flow,${summary.net_flow}`);
        lines.push('');

        // Occupancy Trends
        lines.push('=== Occupancy Trends ===');
        lines.push('Time,Occupancy,Entry,Exit');
        occupancyTrends.current.forEach(d => {
            lines.push(`${d.time},${d.occupancy},${d.entry},${d.exit}`);
        });
        lines.push('');

        // Daily Traffic
        lines.push('=== Daily Traffic ===');
        lines.push('Day,Total In,Total Out');
        trafficDaily.forEach(d => {
            lines.push(`${d.day},${d.total_in},${d.total_out}`);
        });
        lines.push('');

        // Peak by Day
        lines.push('=== Peak Occupancy by Day ===');
        lines.push('Day,Peak,Time');
        peakDaily.forEach(d => {
            lines.push(`${d.day},${d.peak},${d.time}`);
        });
        lines.push('');

        // Dwell Distribution
        lines.push('=== Dwell Time Distribution ===');
        lines.push('Range,Percentage');
        flowRatio.dwell_distribution.forEach(d => {
            lines.push(`${d.range},${d.percentage}%`);
        });
        lines.push('');

        // Weekly Heatmap
        lines.push('=== Weekly Heatmap (Intensity 0-100) ===');
        lines.push('Day,' + Array.from({ length: 24 }, (_, i) => `${i}h`).join(','));
        heatmap.forEach(row => {
            lines.push(`${row.day},${row.hours.map(h => Math.round(h * 100)).join(',')}`);
        });

        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_report_${timeFrame}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [timeFrame]);

    // ── Export PDF ────────────────────────────────────────────────────────
    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);

        try {
            // Get current theme color from computed styles
            const bgColor = getComputedStyle(document.body).backgroundColor || '#0a0d10';

            const dataUrl = await toPng(reportRef.current, {
                pixelRatio: 2,
                backgroundColor: bgColor,
                quality: 1,
                cacheBust: true,
            });

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: 'a4',
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (reportRef.current.offsetHeight * pdfWidth) / reportRef.current.offsetWidth;

            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`dat-analytics-${timeFrame}-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error('Failed to export PDF:', error);
        } finally {
            setIsExporting(false);
        }
    };

    // ── Chart data ───────────────────────────────────────────────────────
    const maxOcc = Math.max(...occupancyTrends.current.map(d => d.occupancy), ...occupancyTrends.previous.map(d => d.occupancy));
    const currentPath = dataToPath(occupancyTrends.current, maxOcc);
    const previousPath = dataToPath(occupancyTrends.previous, maxOcc);
    const areaPath = currentPath + ' L1000,270 L0,270 Z';

    const maxTraffic = Math.max(...trafficDaily.map(d => Math.max(d.total_in, d.total_out)));
    const maxPeak = Math.max(...peakDaily.map(d => d.peak));
    const maxCum = Math.max(...cumulativeTraffic.map(d => Math.max(d.cumulative_in, d.cumulative_out)));
    const maxDwell = Math.max(...dwellByHour.map(d => d.avg_dwell));

    const cumInPath = cumulativeTraffic.map((d, i) => {
        const x = (i / (cumulativeTraffic.length - 1)) * 1000;
        const y = 260 - (d.cumulative_in / maxCum) * 230;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
    const cumOutPath = cumulativeTraffic.map((d, i) => {
        const x = (i / (cumulativeTraffic.length - 1)) * 1000;
        const y = 260 - (d.cumulative_out / maxCum) * 230;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

    const dwellPath = dwellByHour.map((d, i) => {
        const x = (i / (dwellByHour.length - 1)) * 1000;
        const y = 260 - (d.avg_dwell / maxDwell) * 230;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
    const dwellArea = dwellPath + ' L1000,270 L0,270 Z';

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
                        <SegmentedControl options={timeFrameOptions} value={timeFrame} onChange={setTimeFrame} />
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            icon={isExporting ? 'sync' : 'picture_as_pdf'}
                            variant="secondary"
                            size="sm"
                            onClick={handleExportPDF}
                            disabled={isExporting}
                        >
                            {isExporting ? 'Processing...' : 'Export PDF'}
                        </Button>
                        <Button icon="download" variant="ghost" size="sm" onClick={handleExportCSV}>CSV</Button>
                        <StatusDot status="online" label="Real-time sync" />
                    </div>
                </div>

                {/* Scrollable Content */}
                <main ref={reportRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {/* ══════ ROW 1: KPI Cards ══════ */}
                    <div className="grid grid-cols-5 gap-5 stagger-children">
                        {/* 1. Entry */}
                        <Card className="group" hover>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Entry</p>
                            <h2 className="text-3xl font-bold text-success">+{summary.total_in}</h2>
                            <p className="text-[11px] text-text-tertiary mt-3 uppercase tracking-widest font-mono">Cumulative In</p>
                        </Card>

                        {/* 2. Exit */}
                        <Card className="group" hover>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Exit</p>
                            <h2 className="text-3xl font-bold text-orange-500">-{summary.total_out}</h2>
                            <p className="text-[11px] text-text-tertiary mt-3 uppercase tracking-widest font-mono">Cumulative Out</p>
                        </Card>

                        {/* 3. Occupancy */}
                        <Card variant="featured" className="relative overflow-hidden group" hover>
                            <div className="absolute -top-4 -right-4 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
                                <span className="material-symbols-outlined text-[72px] text-accent">groups</span>
                            </div>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Occupancy</p>
                            <h2 className="text-4xl font-bold text-text-primary tracking-tight">{summary.current_occupancy}</h2>
                            <p className="text-[11px] text-text-tertiary mt-3">people in lab now</p>
                        </Card>

                        {/* 4. Peak Hour */}
                        <Card className="group" hover>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Peak Hour</p>
                            <h2 className="text-3xl font-bold text-text-primary">{summary.peak_time}</h2>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="warning">{summary.peak_occupancy} people</Badge>
                            </div>
                        </Card>

                        {/* 5. Avg Dwell Time */}
                        <Card className="group" hover>
                            <p className="text-text-tertiary text-[11px] font-medium uppercase tracking-wider mb-2">Avg Dwell Time</p>
                            <div className="flex items-baseline gap-1.5">
                                <h2 className="text-3xl font-bold text-text-primary">{summary.avg_dwell_time_minutes}</h2>
                                <span className="text-lg text-text-tertiary">min</span>
                            </div>
                            <div className="mt-3 h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full animate-bar-fill" style={{ width: `${Math.min((summary.avg_dwell_time_minutes / 60) * 100, 100)}%` }} />
                            </div>
                        </Card>
                    </div>

                    {/* ══════ Section: Trends ══════ */}
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-widest">Trends</span>
                        <div className="flex-1 h-px bg-border-subtle" />
                    </div>

                    {/* ══════ ROW 2: Occupancy Line Chart + Flow Donut ══════ */}
                    <div className="grid grid-cols-3 gap-5">
                        <Card className="col-span-2 flex flex-col" padding="lg">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-[15px] font-bold text-text-primary">Occupancy Trends</h3>
                                    <p className="text-[13px] text-text-tertiary mt-0.5">Today vs previous period</p>
                                </div>
                                <div className="flex gap-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-0.5 bg-accent rounded" />
                                        <span className="text-[11px] text-text-tertiary">Today</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-0.5 bg-accent/30 rounded border-t border-dashed border-accent/50" />
                                        <span className="text-[11px] text-text-tertiary">Yesterday</span>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full" style={{ height: 240 }}>
                                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 280">
                                    <defs>
                                        <linearGradient id="occGrad" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
                                            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {[65, 130, 195].map(y => (
                                        <line key={y} stroke="var(--border-subtle)" x1="0" x2="1000" y1={y} y2={y} />
                                    ))}
                                    <path d={areaPath} fill="url(#occGrad)" />
                                    <path d={currentPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
                                    <path d={previousPath} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.3" />
                                </svg>
                            </div>
                            <div className="flex justify-between mt-2">
                                {occupancyTrends.current.filter((_, i) => i % 2 === 0).map(d => (
                                    <span key={d.time} className="text-[10px] text-text-tertiary font-mono">{d.time}</span>
                                ))}
                            </div>
                        </Card>

                        <Card className="flex flex-col" padding="lg">
                            <h3 className="text-[15px] font-bold text-text-primary">Flow Ratio</h3>
                            <p className="text-[13px] text-text-tertiary mt-0.5 mb-3">Entry vs Exit</p>
                            <div className="flex items-center justify-center mb-3">
                                <div className="relative size-32">
                                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--surface-3)" strokeWidth="10" />
                                        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--success)" strokeWidth="10"
                                            strokeDasharray={`${flowRatio.entry_exit.in_percentage * 2.39} ${100 * 2.39}`} />
                                        <circle cx="50" cy="50" r="38" fill="none" stroke="#f97316" strokeWidth="10"
                                            strokeDasharray={`${flowRatio.entry_exit.out_percentage * 2.39} ${100 * 2.39}`}
                                            strokeDashoffset={`-${flowRatio.entry_exit.in_percentage * 2.39}`} />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-base font-bold text-text-primary">{summary.total_in + summary.total_out}</span>
                                        <span className="text-[8px] text-text-tertiary uppercase tracking-wider">Total</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-center gap-5 mb-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="size-2 rounded-sm bg-success" />
                                    <span className="text-[11px] text-text-secondary">In {flowRatio.entry_exit.in_percentage}%</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="size-2 rounded-sm bg-orange-500" />
                                    <span className="text-[11px] text-text-secondary">Out {flowRatio.entry_exit.out_percentage}%</span>
                                </div>
                            </div>
                            <div className="border-t border-border-subtle pt-3 flex-1">
                                <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium mb-2">Dwell Distribution</p>
                                <div className="space-y-2">
                                    {flowRatio.dwell_distribution.map(d => (
                                        <div key={d.range} className="flex items-center gap-2">
                                            <span className="text-[10px] text-text-secondary w-14 shrink-0">{d.range}</span>
                                            <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                                                <div className="h-full bg-accent/50 rounded-full" style={{ width: `${d.percentage}%` }} />
                                            </div>
                                            <span className="text-[10px] text-text-primary font-mono w-7 text-right">{d.percentage}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* ══════ ROW 3: Cumulative Area + Dwell by Hour ══════ */}
                    <div className="grid grid-cols-2 gap-5">
                        {/* Cumulative Traffic (Area Chart) */}
                        <Card className="flex flex-col" padding="lg">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-[15px] font-bold text-text-primary">Cumulative Traffic</h3>
                                    <p className="text-[13px] text-text-tertiary mt-0.5">Build-up throughout the day</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <div className="size-2 rounded-sm bg-success" />
                                        <span className="text-[10px] text-text-tertiary">Entry</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="size-2 rounded-sm bg-orange-500" />
                                        <span className="text-[10px] text-text-tertiary">Exit</span>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full" style={{ height: 200 }}>
                                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 280">
                                    <defs>
                                        <linearGradient id="cumInGrad" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="var(--success)" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="var(--success)" stopOpacity="0" />
                                        </linearGradient>
                                        <linearGradient id="cumOutGrad" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="#f97316" stopOpacity="0.15" />
                                            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {[65, 130, 195].map(y => (
                                        <line key={y} stroke="var(--border-subtle)" x1="0" x2="1000" y1={y} y2={y} />
                                    ))}
                                    <path d={cumInPath + ' L1000,270 L0,270 Z'} fill="url(#cumInGrad)" />
                                    <path d={cumInPath} fill="none" stroke="var(--success)" strokeWidth="2" strokeLinejoin="round" />
                                    <path d={cumOutPath + ' L1000,270 L0,270 Z'} fill="url(#cumOutGrad)" />
                                    <path d={cumOutPath} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <div className="flex justify-between mt-2">
                                {cumulativeTraffic.filter((_, i) => i % 2 === 0).map(d => (
                                    <span key={d.time} className="text-[10px] text-text-tertiary font-mono">{d.time}</span>
                                ))}
                            </div>
                        </Card>

                        {/* Dwell Time by Hour (Area Line Chart) */}
                        <Card className="flex flex-col" padding="lg">
                            <div className="mb-4">
                                <h3 className="text-[15px] font-bold text-text-primary">Avg Dwell Time by Hour</h3>
                                <p className="text-[13px] text-text-tertiary mt-0.5">When do visitors stay longest?</p>
                            </div>
                            <div className="w-full" style={{ height: 200 }}>
                                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 280">
                                    <defs>
                                        <linearGradient id="dwellGrad" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {[65, 130, 195].map(y => (
                                        <line key={y} stroke="var(--border-subtle)" x1="0" x2="1000" y1={y} y2={y} />
                                    ))}
                                    <path d={dwellArea} fill="url(#dwellGrad)" />
                                    <path d={dwellPath} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinejoin="round" />
                                    {/* Data points */}
                                    {dwellByHour.map((d, i) => {
                                        const x = (i / (dwellByHour.length - 1)) * 1000;
                                        const y = 260 - (d.avg_dwell / maxDwell) * 230;
                                        return <circle key={i} cx={x} cy={y} r="4" fill="#a78bfa" stroke="var(--surface-1)" strokeWidth="2" />;
                                    })}
                                </svg>
                            </div>
                            <div className="flex justify-between mt-2">
                                {dwellByHour.map(d => (
                                    <span key={d.time} className="text-[10px] text-text-tertiary font-mono">{d.time}</span>
                                ))}
                            </div>
                        </Card>
                    </div>

                    {/* ══════ Section: Breakdown ══════ */}
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-widest">Breakdown</span>
                        <div className="flex-1 h-px bg-border-subtle" />
                    </div>

                    {/* ══════ ROW 4: Heatmap + Daily Traffic ══════ */}
                    <div className="grid grid-cols-12 gap-5">
                        {/* Weekly Heatmap — 7 cols */}
                        <Card className="col-span-7" padding="lg">
                            <h3 className="text-[15px] font-bold text-text-primary">Weekly Heatmap</h3>
                            <p className="text-[13px] text-text-tertiary mt-0.5 mb-4">24h × 7 days activity pattern</p>
                            <div className="space-y-[3px]">
                                {heatmap.map(row => (
                                    <div key={row.day} className="flex items-center gap-2">
                                        <span className="text-[10px] text-text-tertiary font-mono w-8 shrink-0 text-right">{row.day}</span>
                                        <div className="flex gap-[2px] flex-1">
                                            {row.hours.map((intensity, h) => (
                                                <div
                                                    key={h}
                                                    className="flex-1 aspect-[1.2] rounded-[2px] hover:ring-1 hover:ring-accent/50 transition-colors cursor-crosshair"
                                                    style={{ backgroundColor: `rgba(59, 130, 246, ${0.06 + intensity * 0.88})` }}
                                                    title={`${row.day} ${h}:00 — ${Math.round(intensity * 100)}%`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex mt-2 ml-10 justify-between pr-1">
                                {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
                                    <span key={h} className="text-[9px] text-text-tertiary font-mono">{h}h</span>
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

                        {/* Daily Traffic Bar — 5 cols */}
                        <Card className="col-span-5" padding="lg">
                            <h3 className="text-[15px] font-bold text-text-primary">Daily Traffic</h3>
                            <p className="text-[13px] text-text-tertiary mt-0.5 mb-4">Entry vs Exit by day</p>
                            <div className="flex items-end gap-3" style={{ height: 200 }}>
                                {trafficDaily.map(d => (
                                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                                        <div className="w-full flex gap-[3px] justify-center h-[170px]">
                                            <div className="flex flex-col justify-end w-[42%]">
                                                <div
                                                    className="bg-success/70 rounded-t-sm hover:bg-success transition-colors"
                                                    style={{ height: `${(d.total_in / maxTraffic) * 100}%` }}
                                                    title={`In: ${d.total_in}`}
                                                />
                                            </div>
                                            <div className="flex flex-col justify-end w-[42%]">
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
                            <div className="flex justify-center gap-6 mt-3 pt-3 border-t border-border-subtle">
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

                    {/* ══════ ROW 5: Peak by Day ══════ */}
                    <Card padding="lg">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-[15px] font-bold text-text-primary">Peak Occupancy by Day</h3>
                                <p className="text-[13px] text-text-tertiary mt-0.5">Maximum headcount reached each day</p>
                            </div>
                            <Badge variant="warning">Threshold: 80</Badge>
                        </div>
                        <div className="flex items-end gap-4" style={{ height: 160 }}>
                            {peakDaily.map(d => {
                                const pct = (d.peak / maxPeak) * 100;
                                const isOver = d.peak >= 80;
                                return (
                                    <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                                        <span className="text-[11px] font-mono font-bold text-text-primary">{d.peak}</span>
                                        <div className="w-full flex justify-center" style={{ height: 110 }}>
                                            <div className="flex flex-col justify-end w-[60%]">
                                                <div
                                                    className={`rounded-t-sm transition-colors ${isOver ? 'bg-danger/70 hover:bg-danger' : 'bg-accent/50 hover:bg-accent/70'}`}
                                                    style={{ height: `${pct}%` }}
                                                    title={`Peak: ${d.peak} at ${d.time}`}
                                                />
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-[10px] text-text-tertiary font-mono block">{d.day}</span>
                                            <span className="text-[9px] text-text-tertiary">{d.time}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Threshold line visual cue */}
                        <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-px border-t border-dashed border-danger/40" />
                            <span className="text-[9px] text-danger/60 font-mono">threshold = 80</span>
                            <div className="flex-1 h-px border-t border-dashed border-danger/40" />
                        </div>
                    </Card>

                    {/* Bottom padding */}
                    <div className="h-4" />
                </main>
            </div>
        </div>
    );
}
