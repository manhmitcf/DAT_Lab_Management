'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Period } from '@/lib/analyticsApi';
import {
    fetchSummary,
    fetchOccupancyTrends,
    fetchHeatmap,
    fetchTrafficDaily,
    fetchFlowRatio,
    fetchPeakDaily,
    fetchCumulativeTraffic,
} from '@/lib/analyticsApi';
import { analyticsData } from '@/lib/mockData';

export interface AnalyticsDataState {
    summary: typeof analyticsData.summary;
    occupancyTrends: {
        current: Array<{ time: string; occupancy: number; entry: number; exit: number }>;
        previous: Array<{ time: string; occupancy: number; entry: number; exit: number }>;
    };
    heatmap: typeof analyticsData.heatmap;
    trafficDaily: typeof analyticsData.trafficDaily;
    flowRatio: typeof analyticsData.flowRatio;
    peakDaily: typeof analyticsData.peakDaily;
    cumulativeTraffic: typeof analyticsData.cumulativeTraffic;
}

function getDefaultData(): AnalyticsDataState {
    return {
        summary: analyticsData.summary,
        occupancyTrends: analyticsData.occupancyTrends,
        heatmap: analyticsData.heatmap,
        trafficDaily: analyticsData.trafficDaily,
        flowRatio: analyticsData.flowRatio,
        peakDaily: analyticsData.peakDaily,
        cumulativeTraffic: analyticsData.cumulativeTraffic,
    };
}

/** Client-side cache TTL (ms) — aligns with BE Cache-Control max-age; avoids redundant fetches when toggling period. */
const CACHE_TTL_MS = 45_000;

const cache = new Map<string, { data: AnalyticsDataState; at: number }>();

function cacheKey(period: Period, heatmapPeriod: string, trafficPeakPeriod: string) {
    return `${period}|${heatmapPeriod}|${trafficPeakPeriod}`;
}

export function useAnalyticsData(period: Period) {
    const [data, setData] = useState<AnalyticsDataState>(getDefaultData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const refetch = useCallback(async (force = false) => {
        const heatmapPeriod = period === '1h' || period === 'today' ? '7d' : period;
        const trafficPeakPeriod = period === '1h' || period === 'today' ? '7d' : period;
        const key = cacheKey(period, heatmapPeriod, trafficPeakPeriod);

        const cached = cache.get(key);
        const now = Date.now();
        if (!force && cached && now - cached.at < CACHE_TTL_MS) {
            setData(cached.data);
            setLoading(false);
            setError(null);
            return;
        }

        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        const signal = ac.signal;

        setLoading(true);
        setError(null);
        const defaultData = getDefaultData();

        const fetchOpts = { signal } as RequestInit;

        try {
            const [summaryRes, trendsRes, heatmapRes, trafficRes, flowRes, peakRes, cumRes] = await Promise.allSettled([
                fetchSummary(period, fetchOpts),
                fetchOccupancyTrends(period, fetchOpts),
                fetchHeatmap(heatmapPeriod, fetchOpts),
                fetchTrafficDaily(trafficPeakPeriod, fetchOpts),
                fetchFlowRatio(period, fetchOpts),
                fetchPeakDaily(trafficPeakPeriod, fetchOpts),
                fetchCumulativeTraffic(period, fetchOpts),
            ]);

            if (signal.aborted) return;

            const errors: string[] = [];
            const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : null;
            const trends = trendsRes.status === 'fulfilled' ? trendsRes.value : null;
            const heatmapData = heatmapRes.status === 'fulfilled' ? heatmapRes.value.data : null;
            const trafficData = trafficRes.status === 'fulfilled' ? trafficRes.value.data : null;
            const flowData = flowRes.status === 'fulfilled' ? flowRes.value : null;
            const peakData = peakRes.status === 'fulfilled' ? peakRes.value.data : null;
            const cumData = cumRes.status === 'fulfilled' ? cumRes.value.data : null;

            if (summaryRes.status === 'rejected') errors.push('summary');
            if (trendsRes.status === 'rejected') errors.push('trends');
            if (heatmapRes.status === 'rejected') errors.push('heatmap');
            if (trafficRes.status === 'rejected') errors.push('traffic');
            if (flowRes.status === 'rejected') errors.push('flow');
            if (peakRes.status === 'rejected') errors.push('peak');
            if (cumRes.status === 'rejected') errors.push('cumulative');

            const next: AnalyticsDataState = {
                summary: summary
                    ? { ...summary, peak_time: summary.peak_time ?? '' }
                    : defaultData.summary,
                occupancyTrends:
                    trends ?
                        {
                            current: trends.current.map((t) => ({ ...t, entry: t.ingress, exit: t.egress })),
                            previous: trends.previous.map((t) => ({ ...t, entry: t.ingress, exit: t.egress })),
                        }
                    : defaultData.occupancyTrends,
                heatmap: heatmapData ?? defaultData.heatmap,
                trafficDaily: trafficData ?? defaultData.trafficDaily,
                flowRatio: flowData ?? defaultData.flowRatio,
                peakDaily: peakData ? peakData.map((p) => ({ ...p, time: p.time ?? '' })) : defaultData.peakDaily,
                cumulativeTraffic: cumData ?? defaultData.cumulativeTraffic,
            };

            setData(next);
            cache.set(key, { data: next, at: Date.now() });
            if (errors.length > 0) {
                setError(`Partial: ${errors.join(', ')} failed`);
            }
        } catch (e) {
            if ((e as Error).name === 'AbortError') return;
            setError(e instanceof Error ? e.message : 'Fetch failed');
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        refetch();
        return () => abortRef.current?.abort();
    }, [refetch]);

    return { data, loading, error, refetch };
}
