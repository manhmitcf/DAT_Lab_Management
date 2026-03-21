'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Period } from '@/lib/analyticsApi';
import {
    fetchSummary,
    fetchOccupancyTrends,
    fetchHeatmap,
    fetchTrafficDaily,
    fetchFlowRatio,
    fetchPeakDaily,
    fetchCumulativeTraffic,
    fetchDwellByHour,
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
    dwellByHour: typeof analyticsData.dwellByHour;
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
        dwellByHour: analyticsData.dwellByHour,
    };
}

export function useAnalyticsData(period: Period) {
    const [data, setData] = useState<AnalyticsDataState>(getDefaultData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [summary, trends, heatmapRes, trafficRes, flowRes, peakRes, cumRes, dwellRes] = await Promise.all([
                fetchSummary(period),
                fetchOccupancyTrends(period),
                fetchHeatmap(period === '1h' || period === 'today' ? '7d' : period),
                fetchTrafficDaily(period === '1h' || period === 'today' ? '7d' : period),
                fetchFlowRatio(period),
                fetchPeakDaily(period === '1h' || period === 'today' ? '7d' : period),
                fetchCumulativeTraffic(period),
                fetchDwellByHour(period),
            ]);

            setData({
                summary: { ...summary, peak_time: summary.peak_time ?? '' },
                occupancyTrends: {
                    current: trends.current.map((t) => ({ ...t, entry: t.ingress, exit: t.egress })),
                    previous: trends.previous.map((t) => ({ ...t, entry: t.ingress, exit: t.egress })),
                },
                heatmap: heatmapRes.data,
                trafficDaily: trafficRes.data,
                flowRatio: flowRes,
                peakDaily: peakRes.data.map((p) => ({ ...p, time: p.time ?? '' })),
                cumulativeTraffic: cumRes.data,
                dwellByHour: dwellRes.data,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load analytics');
            setData(getDefaultData());
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { data, loading, error, refetch };
}
