'use client';

import { useState, useEffect } from 'react';
import MainSidebar from '@/components/layout/MainSidebar';
import MappingCalibration from '@/components/panels/MappingCalibration';

export default function SettingsPage() {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [statsRetention, setStatsRetention] = useState('30');
    const [occupancyThreshold, setOccupancyThreshold] = useState(25);
    const [notifications, setNotifications] = useState({
        email: true,
        slack: false,
        push: true,
    });
    const [systemMode, setSystemMode] = useState('production');

    // Initialize theme from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        if (savedTheme) {
            setTheme(savedTheme);
        }
    }, []);

    const toggleTheme = (newTheme: 'light' | 'dark') => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    return (
        <div className="flex h-screen w-full bg-surface-0">
            <MainSidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden animate-fade-in">
                <header className="shrink-0 bg-surface-1 border-b border-border-default h-16 flex items-center px-8">
                    <h2 className="text-xl font-bold text-text-primary tracking-tight">Settings</h2>
                </header>

                <main className="flex-1 overflow-y-auto p-8 space-y-8 bg-surface-0 custom-scrollbar">
                    {/* --- APPEARANCE --- */}
                    <section className="max-w-4xl animate-slide-up" style={{ animationDelay: '0ms' }}>
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider">Appearance</h3>
                            <p className="text-xs text-text-tertiary mt-1">Customize the visual interface of the dashboard.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => toggleTheme('light')}
                                className={`p-4 rounded-[var(--radius-lg)] border-2 transition-all flex flex-col gap-3 group ${theme === 'light' ? 'border-accent bg-accent/5' : 'border-border-subtle bg-surface-1 hover:border-border-strong'}`}
                            >
                                <div className="w-full aspect-video rounded-[var(--radius-md)] bg-white border border-slate-200 overflow-hidden relative">
                                    <div className="absolute top-2 left-2 w-1/4 h-2 bg-slate-100 rounded" />
                                    <div className="absolute top-6 left-2 w-3/4 h-12 bg-slate-50 border border-slate-100 rounded" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-xl">light_mode</span>
                                    <span className="text-sm font-medium">Light Mode</span>
                                    {theme === 'light' && <span className="material-symbols-outlined text-accent ml-auto">check_circle</span>}
                                </div>
                            </button>

                            <button
                                onClick={() => toggleTheme('dark')}
                                className={`p-4 rounded-[var(--radius-lg)] border-2 transition-all flex flex-col gap-3 group ${theme === 'dark' ? 'border-accent bg-accent/5' : 'border-border-subtle bg-surface-1 hover:border-border-strong'}`}
                            >
                                <div className="w-full aspect-video rounded-[var(--radius-md)] bg-[#0a0d10] border border-slate-800 overflow-hidden relative">
                                    <div className="absolute top-2 left-2 w-1/4 h-2 bg-slate-800 rounded" />
                                    <div className="absolute top-6 left-2 w-3/4 h-12 bg-slate-900 border border-slate-800 rounded" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-xl">dark_mode</span>
                                    <span className="text-sm font-medium">Dark Mode</span>
                                    {theme === 'dark' && <span className="material-symbols-outlined text-accent ml-auto">check_circle</span>}
                                </div>
                            </button>
                        </div>
                    </section>

                    <hr className="border-border-subtle" />

                    {/* --- ANALYTICS CONFIG --- */}
                    <section className="max-w-4xl animate-slide-up" style={{ animationDelay: '100ms' }}>
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider">Analytics & Data</h3>
                            <p className="text-xs text-text-tertiary mt-1">Configure thresholds and historical data retention.</p>
                        </div>
                        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-xl)] divide-y divide-border-subtle">
                            <div className="p-5 flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">Data Retention Policy</span>
                                    <span className="text-xs text-text-tertiary">How long to store person detection IDs and poses.</span>
                                </div>
                                <select
                                    value={statsRetention}
                                    onChange={(e) => setStatsRetention(e.target.value)}
                                    className="bg-surface-2 border border-border-default rounded-[var(--radius-sm)] px-3 py-1.5 text-xs focus:ring-2 ring-accent outline-none"
                                >
                                    <option value="7">7 Days</option>
                                    <option value="30">30 Days</option>
                                    <option value="90">90 Days</option>
                                    <option value="365">1 Year</option>
                                </select>
                            </div>
                            <div className="p-5 flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">Max Occupancy Threshold</span>
                                    <span className="text-xs text-text-tertiary">Trigger alert when occupancy exceeds this value.</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range" min="1" max="100"
                                        value={occupancyThreshold}
                                        onChange={(e) => setOccupancyThreshold(parseInt(e.target.value))}
                                        className="w-32 accent-accent cursor-pointer"
                                    />
                                    <span className="text-sm font-mono text-accent min-w-[2ch]">{occupancyThreshold}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-border-subtle" />

                    {/* --- 2D MAPPING CALIBRATION --- */}
                    <section className="max-w-4xl animate-slide-up" style={{ animationDelay: '200ms' }}>
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider">
                                2D Mapping Calibration
                            </h3>
                            <p className="text-xs text-text-tertiary mt-1">
                                Define point correspondences between the camera frame and the floor plan
                                to calibrate the homography transform used by the backend.
                            </p>
                        </div>
                        <MappingCalibration />
                    </section>

                    <hr className="border-border-subtle" />

                    {/* --- NOTIFICATIONS --- */}
                    <section className="max-w-4xl animate-slide-up" style={{ animationDelay: '300ms' }}>
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider">Notification Channels</h3>
                            <p className="text-xs text-text-tertiary mt-1">Integrations for real-time security alerts.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-surface-1 border border-border-default p-4 rounded-[var(--radius-lg)] flex flex-col gap-3">
                                <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                    <span className="material-symbols-outlined">mail</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Email Alerts</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={notifications.email} onChange={() => setNotifications({ ...notifications, email: !notifications.email })} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
                                    </label>
                                </div>
                            </div>
                            <div className="bg-surface-1 border border-border-default p-4 rounded-[var(--radius-lg)] flex flex-col gap-3">
                                <div className="size-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                                    <span className="material-symbols-outlined">chat_bubble</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Slack Webhook</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={notifications.slack} onChange={() => setNotifications({ ...notifications, slack: !notifications.slack })} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
                                    </label>
                                </div>
                            </div>
                            <div className="bg-surface-1 border border-border-default p-4 rounded-[var(--radius-lg)] flex flex-col gap-3">
                                <div className="size-10 rounded-full bg-accent-muted flex items-center justify-center text-accent">
                                    <span className="material-symbols-outlined">vibration</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Push App</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={notifications.push} onChange={() => setNotifications({ ...notifications, push: !notifications.push })} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
