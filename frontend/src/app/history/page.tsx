'use client';

import { useState } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import StatusDot from '@/components/ui/StatusDot';
import SegmentedControl from '@/components/ui/SegmentedControl';

type ViewMode = 'timeline' | 'gallery';

const viewOptions: { value: ViewMode; label: string }[] = [
    { value: 'timeline', label: 'Timeline' },
    { value: 'gallery', label: 'Gallery' },
];

// Mock history data (single camera)
const historyRecordings = [
    {
        id: 'rec-001',
        date: '2026-02-28',
        time_start: '08:00:00',
        time_end: '08:30:00',
        location: 'DAT Lab',
        thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=60',
        duration: '30:00',
        events: 12,
        peak_occupancy: 34,
        alerts: 1,
    },
    {
        id: 'rec-002',
        date: '2026-02-28',
        time_start: '09:15:00',
        time_end: '09:45:00',
        location: 'DAT Lab',
        thumbnail: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&q=60',
        duration: '30:00',
        events: 8,
        peak_occupancy: 18,
        alerts: 0,
    },
    {
        id: 'rec-003',
        date: '2026-02-28',
        time_start: '10:30:00',
        time_end: '11:00:00',
        location: 'DAT Lab',
        thumbnail: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&q=60',
        duration: '30:00',
        events: 23,
        peak_occupancy: 52,
        alerts: 3,
    },
    {
        id: 'rec-004',
        date: '2026-02-27',
        time_start: '14:00:00',
        time_end: '14:30:00',
        location: 'DAT Lab',
        thumbnail: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=400&q=60',
        duration: '30:00',
        events: 5,
        peak_occupancy: 8,
        alerts: 1,
    },
    {
        id: 'rec-005',
        date: '2026-02-27',
        time_start: '16:45:00',
        time_end: '17:15:00',
        location: 'DAT Lab',
        thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=60',
        duration: '30:00',
        events: 31,
        peak_occupancy: 67,
        alerts: 2,
    },
];

export default function HistoryPage() {
    const [viewMode, setViewMode] = useState<ViewMode>('timeline');
    const [selectedDate, setSelectedDate] = useState('2026-02-28');
    const [fromTime, setFromTime] = useState('08:00');
    const [toTime, setToTime] = useState('09:00');
    const [selectedRecording, setSelectedRecording] = useState<string | null>(null);

    const filteredRecordings = historyRecordings.filter(r => {
        if (r.date !== selectedDate) return false;
        const recStart = r.time_start.slice(0, 5);
        const recEnd = r.time_end.slice(0, 5);
        return recStart >= fromTime && recEnd <= toTime;
    });

    const selected = historyRecordings.find(r => r.id === selectedRecording);

    return (
        <div className="flex h-screen w-full bg-surface-0">
            <MainSidebar />

            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                {/* Toolbar */}
                <div className="px-6 py-3.5 bg-surface-1 border-b border-border-default flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-accent text-xl">history</span>
                            <h1 className="text-lg font-bold text-text-primary tracking-tight">History</h1>
                        </div>

                        <div className="h-5 w-px bg-border-subtle" />

                        {/* Date picker */}
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-surface-0 border border-border-default rounded-[var(--radius-md)] px-3 py-1.5 text-sm text-text-primary focus:ring-1 focus:ring-accent focus:border-accent font-mono"
                        />

                        <div className="h-5 w-px bg-border-subtle" />

                        {/* Time range pickers */}
                        <div className="flex items-center gap-2">
                            <input
                                type="time"
                                value={fromTime}
                                onChange={(e) => setFromTime(e.target.value)}
                                className="bg-surface-0 border border-border-default rounded-[var(--radius-md)] px-2 py-1.5 text-sm text-text-primary focus:ring-1 focus:ring-accent font-mono"
                            />
                            <span className="text-text-tertiary text-xs">→</span>
                            <input
                                type="time"
                                value={toTime}
                                onChange={(e) => setToTime(e.target.value)}
                                className="bg-surface-0 border border-border-default rounded-[var(--radius-md)] px-2 py-1.5 text-sm text-text-primary focus:ring-1 focus:ring-accent font-mono"
                            />
                            <span className="text-[10px] text-text-tertiary font-mono">(max 1h)</span>
                        </div>

                        <div className="h-5 w-px bg-border-subtle" />

                        <SegmentedControl options={viewOptions} value={viewMode} onChange={setViewMode} />
                    </div>

                    <div className="flex items-center gap-3">
                        <Button icon="download" variant="secondary" size="sm">Export</Button>
                        <StatusDot status="online" label="Archive Connected" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Recording list */}
                    <div className={`${selectedRecording ? 'w-[380px]' : 'flex-1 max-w-5xl mx-auto'} shrink-0 overflow-y-auto p-4 transition-all duration-300`}>
                        {filteredRecordings.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <span className="material-symbols-outlined text-5xl text-text-tertiary mb-3">video_library</span>
                                <p className="text-text-secondary text-sm">No recordings found for this date.</p>
                                <p className="text-text-tertiary text-xs mt-1">Try selecting a different date or time range.</p>
                            </div>
                        ) : (
                            <div className={`${viewMode === 'gallery' && !selectedRecording ? 'grid grid-cols-3 gap-4' : 'space-y-3'} stagger-children`}>
                                {filteredRecordings.map((rec) => (
                                    <div
                                        key={rec.id}
                                        onClick={() => setSelectedRecording(selectedRecording === rec.id ? null : rec.id)}
                                        className={`
                                            rounded-[var(--radius-lg)] border overflow-hidden cursor-pointer group
                                            transition-all duration-[var(--duration-fast)]
                                            ${selectedRecording === rec.id
                                                ? 'border-accent bg-accent/5 shadow-[var(--shadow-glow-accent)]'
                                                : 'border-border-default bg-surface-2 hover:border-border-strong hover:shadow-md'
                                            }
                                        `}
                                    >
                                        {/* Thumbnail */}
                                        <div className="relative aspect-video overflow-hidden">
                                            <div
                                                className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                                                style={{ backgroundImage: `url('${rec.thumbnail}')` }}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                                            {/* Duration badge */}
                                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-white">
                                                {rec.duration}
                                            </div>



                                            {/* Play button */}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="size-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-accent transition-colors">
                                                    <span className="material-symbols-outlined text-2xl">play_arrow</span>
                                                </div>
                                            </div>

                                            {/* Bottom info */}
                                            <div className="absolute bottom-2 left-2 right-2">
                                                <p className="text-white text-xs font-semibold">{rec.location}</p>
                                                <p className="text-white/70 text-[10px] font-mono">{rec.time_start} — {rec.time_end}</p>
                                            </div>
                                        </div>

                                        {/* Stats row */}
                                        <div className="px-3 py-2.5 flex items-center justify-between">
                                            <div className="flex items-center gap-4 text-[11px]">
                                                <span className="text-text-secondary">
                                                    <b className="text-text-primary font-semibold">{rec.events}</b> events
                                                </span>
                                                <span className="text-text-secondary">
                                                    Peak: <b className="text-text-primary font-semibold">{rec.peak_occupancy}</b>
                                                </span>
                                            </div>
                                            {rec.alerts > 0 && (
                                                <Badge variant="danger" size="sm">{rec.alerts} alert{rec.alerts > 1 ? 's' : ''}</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Playback panel — shows when a recording is selected */}
                    {selected && (
                        <div className="flex-1 border-l border-border-default flex flex-col overflow-hidden animate-slide-in">
                            {/* Video player */}
                            <div className="flex-1 relative bg-black overflow-hidden">
                                <div
                                    className="absolute inset-0 bg-cover bg-center opacity-60"
                                    style={{ backgroundImage: `url('${selected.thumbnail}')` }}
                                />

                                {/* Overlay info */}
                                <div className="absolute top-4 left-4 flex gap-2">
                                    <div className="bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-[var(--radius-md)] text-[11px] text-white font-mono flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-accent">videocam</span>
                                        {selected.location}
                                    </div>
                                    <Badge variant="info">Playback</Badge>
                                </div>

                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button
                                        onClick={() => setSelectedRecording(null)}
                                        className="bg-black/60 backdrop-blur-md text-white size-9 rounded-[var(--radius-md)] border border-white/10 flex items-center justify-center hover:bg-surface-4 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>

                                {/* Center play */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <button className="size-16 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-accent transition-colors active:scale-95">
                                        <span className="material-symbols-outlined text-4xl">play_arrow</span>
                                    </button>
                                </div>

                                {/* Bottom timeline scrubber */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-8">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-white/80 text-[11px] font-mono">{selected.time_start}</span>
                                        <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer group">
                                            <div className="h-full bg-accent rounded-full w-[35%] group-hover:bg-accent-strong transition-colors" />
                                        </div>
                                        <span className="text-white/80 text-[11px] font-mono">{selected.time_end}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <button className="size-8 text-white/70 hover:text-white rounded flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-lg">skip_previous</span>
                                            </button>
                                            <button className="size-8 text-white/70 hover:text-white rounded flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-lg">fast_rewind</span>
                                            </button>
                                            <button className="size-10 bg-white/10 hover:bg-accent text-white rounded-full flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-xl">play_arrow</span>
                                            </button>
                                            <button className="size-8 text-white/70 hover:text-white rounded flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-lg">fast_forward</span>
                                            </button>
                                            <button className="size-8 text-white/70 hover:text-white rounded flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-lg">skip_next</span>
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-white/50 text-[10px] font-mono">1x</span>
                                            <button className="size-8 text-white/70 hover:text-white rounded flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-lg">fullscreen</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats at time of recording */}
                            <div className="shrink-0 bg-surface-1 border-t border-border-default p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-accent text-sm">analytics</span>
                                    <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Stats at Recording Time</h3>
                                </div>
                                <div className="grid grid-cols-4 gap-3 stagger-children">
                                    <Card padding="sm">
                                        <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">Events</p>
                                        <p className="text-xl font-bold text-text-primary mt-1">{selected.events}</p>
                                    </Card>
                                    <Card padding="sm">
                                        <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">Peak Occupancy</p>
                                        <p className="text-xl font-bold text-text-primary mt-1">{selected.peak_occupancy}</p>
                                    </Card>
                                    <Card padding="sm">
                                        <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">Alerts</p>
                                        <p className={`text-xl font-bold mt-1 ${selected.alerts > 0 ? 'text-danger' : 'text-success'}`}>
                                            {selected.alerts}
                                        </p>
                                    </Card>
                                    <Card padding="sm">
                                        <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">Duration</p>
                                        <p className="text-xl font-bold text-text-primary mt-1 font-mono">{selected.duration}</p>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
