/**
 * Analytics API client — fetches from backend per ANALYTICS_API.md
 * Base: /api/lab_management/analytics/
 */

import { API_BASE } from '@/config/api';

const ANALYTICS_BASE = `${API_BASE}/api/lab_management/analytics`;

export type Period = '1h' | 'today' | '7d' | '30d';

export interface SummaryResponse {
    current_occupancy: number;
    peak_occupancy: number;
    peak_time: string | null;
    avg_dwell_time_minutes: number;
    total_in: number;
    total_out: number;
    net_flow: number;
}

export interface OccupancyTrendPoint {
    time: string;
    occupancy: number;
    ingress: number;
    egress: number;
}

export interface OccupancyTrendsResponse {
    current: OccupancyTrendPoint[];
    previous: OccupancyTrendPoint[];
}

export interface HeatmapRow {
    day: string;
    hours: number[];
}

export interface TrafficDailyPoint {
    day: string;
    total_in: number;
    total_out: number;
}

export interface FlowRatioResponse {
    entry_exit: {
        total_in: number;
        total_out: number;
        in_percentage: number;
        out_percentage: number;
    };
    dwell_distribution: Array<{ range: string; percentage: number }>;
}

export interface PeakDailyPoint {
    day: string;
    peak: number;
    time: string | null;
}

export interface CumulativeTrafficPoint {
    time: string;
    cumulative_in: number;
    cumulative_out: number;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { ...init, cache: 'default' });
    if (!res.ok) throw new Error(`Analytics API error: ${res.status}`);
    return res.json();
}

export async function fetchSummary(period: Period, init?: RequestInit): Promise<SummaryResponse> {
    return fetchJson(`${ANALYTICS_BASE}/summary?period=${period}`, init);
}

export async function fetchOccupancyTrends(period: Period, init?: RequestInit): Promise<OccupancyTrendsResponse> {
    return fetchJson(`${ANALYTICS_BASE}/occupancy-trends?period=${period}`, init);
}

export async function fetchHeatmap(period: Period = '7d', init?: RequestInit): Promise<{ data: HeatmapRow[] }> {
    return fetchJson(`${ANALYTICS_BASE}/heatmap?period=${period}`, init);
}

export async function fetchTrafficDaily(period: Period = '7d', init?: RequestInit): Promise<{ data: TrafficDailyPoint[] }> {
    return fetchJson(`${ANALYTICS_BASE}/traffic-daily?period=${period}`, init);
}

export async function fetchFlowRatio(period: Period, init?: RequestInit): Promise<FlowRatioResponse> {
    return fetchJson(`${ANALYTICS_BASE}/flow-ratio?period=${period}`, init);
}

export async function fetchPeakDaily(period: Period = '7d', init?: RequestInit): Promise<{ data: PeakDailyPoint[] }> {
    return fetchJson(`${ANALYTICS_BASE}/peak-daily?period=${period}`, init);
}

export async function fetchCumulativeTraffic(period: Period, init?: RequestInit): Promise<{ data: CumulativeTrafficPoint[] }> {
    return fetchJson(`${ANALYTICS_BASE}/cumulative-traffic?period=${period}`, init);
}

/** Returns CSV blob for download */
export async function fetchExportCsv(period: Period): Promise<Blob> {
    const url = `${ANALYTICS_BASE}/export?period=${period}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Export API error: ${res.status}`);
    return res.blob();
}
