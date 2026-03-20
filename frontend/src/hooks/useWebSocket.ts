'use client';

import { useEffect, useRef, useCallback } from 'react';
import { FLOOR_PLAN_MAP_SIZE, WS_URLS } from '@/config/api';
import { useTrackingStore } from '@/stores/trackingStore';
import type { FrameData, Person, FloorPlanMarker } from '@/types';

const RECONNECT_DELAY_MS = 5000;

function resolvePersonCount(data: FrameData, objectsLen: number): number {
    const o = data.occupancy;
    if (typeof o === 'number' && Number.isFinite(o) && o >= 0) {
        return Math.floor(o);
    }
    return objectsLen;
}

function resolveFpsFromPayload(data: FrameData, clientFps: number): number {
    const f = data.fps;
    if (typeof f === 'number' && Number.isFinite(f) && f >= 0) {
        return Math.round(f * 10) / 10;
    }
    return clientFps;
}

export function useWebSocket() {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const mountedRef = useRef(true);

    const lastFrameTimeRef = useRef<number>(0);
    const frameIntervalsRef = useRef<number[]>([]);

    const computeFps = (): number => {
        const now = Date.now();
        if (lastFrameTimeRef.current > 0) {
            const interval = now - lastFrameTimeRef.current;
            frameIntervalsRef.current = [...frameIntervalsRef.current.slice(-14), interval];
        }
        lastFrameTimeRef.current = now;
        if (frameIntervalsRef.current.length === 0) return 0;
        const avg =
            frameIntervalsRef.current.reduce((a, b) => a + b, 0) /
            frameIntervalsRef.current.length;
        return Math.round(1000 / avg);
    };

    const applyPayload = useCallback((data: FrameData) => {
        const store = useTrackingStore.getState();
        const clientFps = computeFps();
        const fps = resolveFpsFromPayload(data, clientFps);

        if (typeof data.frame_image === 'string' && data.frame_image.length > 0) {
            store.setCurrentFrame(`data:image/jpeg;base64,${data.frame_image}`);
        }

        const objects = data.objects ?? [];
        const frameW = data.width_frame ?? 1280;
        const frameH = data.height_frame ?? 720;
        const mapW = data.width_2D ?? FLOOR_PLAN_MAP_SIZE.width;
        const mapH = data.height_2D ?? FLOOR_PLAN_MAP_SIZE.height;
        const personCount = resolvePersonCount(data, objects.length);

        const persons: Person[] = objects.map((obj) => ({
            track_id: obj.track_id,
            bbox: {
                x: obj.bbox[0] / frameW,
                y: obj.bbox[1] / frameH,
                width: (obj.bbox[2] - obj.bbox[0]) / frameW,
                height: (obj.bbox[3] - obj.bbox[1]) / frameH,
            },
            keypoints: [],
            behavior: 'standing' as const,
            confidence: 0.9,
            timestamp: data.timestamp ?? new Date().toISOString(),
        }));

        const markers: FloorPlanMarker[] = objects.map((obj) => ({
            id: obj.track_id,
            x: (obj.coordinates_2D[0] / mapW) * 100,
            y: (obj.coordinates_2D[1] / mapH) * 100,
            type: 'active' as const,
            label: `Person #${obj.track_id}`,
        }));

        store.setPersons(persons);
        store.setMarkers(markers);
        store.setAlertLevel(data.alert ?? 'none');
        store.setStats({
            person_count: personCount,
            person_count_change: 0,
            entry_today: data.count_in ?? 0,
            exit_today: data.count_out ?? 0,
            fps,
            behavior_distribution: { walking: 0, standing: 0, loitering: 0, other: 0 },
            throughput: store.stats.throughput,
        });
        store.pushOccupancySample(personCount);
    }, []);

    const connect = useCallback(() => {
        if (!mountedRef.current) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        useTrackingStore.getState().setWsStatus('connecting');

        const ws = new WebSocket(WS_URLS.persistMetadata);
        wsRef.current = ws;

        ws.onopen = () => {
            if (!mountedRef.current) {
                ws.close();
                return;
            }
            useTrackingStore.getState().setIsOnline(true);
            useTrackingStore.getState().setWsStatus('connected');
        };

        ws.onmessage = (event: MessageEvent) => {
            if (!mountedRef.current) return;

            if (event.data instanceof ArrayBuffer) {
                const fps = computeFps();
                const store = useTrackingStore.getState();
                const prevFrame = store.currentFrame;
                if (prevFrame?.startsWith('blob:')) {
                    URL.revokeObjectURL(prevFrame);
                }
                const blob = new Blob([event.data], { type: 'image/jpeg' });
                store.setCurrentFrame(URL.createObjectURL(blob));
                store.setStats({ ...store.stats, fps });
                return;
            }

            if (typeof event.data === 'string') {
                try {
                    const data = JSON.parse(event.data) as FrameData;
                    applyPayload(data);
                } catch (err) {
                    console.error('[WS] parse error:', err);
                }
            }
        };

        ws.onerror = () => {
            useTrackingStore.getState().setIsOnline(false);
            useTrackingStore.getState().setWsStatus('error');
        };

        ws.onclose = () => {
            useTrackingStore.getState().setIsOnline(false);
            useTrackingStore.getState().setWsStatus('disconnected');
            if (mountedRef.current) {
                reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
            }
        };
    }, [applyPayload]);

    useEffect(() => {
        mountedRef.current = true;
        connect();
        return () => {
            mountedRef.current = false;
            clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
            const frame = useTrackingStore.getState().currentFrame;
            if (frame?.startsWith('blob:')) URL.revokeObjectURL(frame);
        };
    }, [connect]);
}
