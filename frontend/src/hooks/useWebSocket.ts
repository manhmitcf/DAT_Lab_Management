'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTrackingStore } from '@/stores/trackingStore';
import type { Person, FloorPlanMarker } from '@/types';

const WS_URL =
    'wss://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net/ws/frontend/frames/';
const RECONNECT_DELAY_MS = 5000;

interface WsObject {
    track_id: number;
    bbox: [number, number, number, number];
    coordinates_2D: [number, number];
}

interface WsPayload {
    timestamp?: string;
    count_in?: number;
    count_out?: number;
    alert?: 'none' | 'info' | 'warning' | 'critical';
    save_to_db?: boolean;
    height_frame?: number;
    width_frame?: number;
    height_2D?: number;
    width_2D?: number;
    frame_image?: string;
    objects?: WsObject[];
}

export function useWebSocket() {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const mountedRef = useRef(true);

    // FPS computation
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

    const connect = useCallback(() => {
        if (!mountedRef.current) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        useTrackingStore.getState().setWsStatus('connecting');

        const ws = new WebSocket(WS_URL);
        // Receive image frames as ArrayBuffer (raw binary JPEG)
        ws.binaryType = 'arraybuffer';
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

            // ── Binary message → raw JPEG frame ──────────────────────────
            if (event.data instanceof ArrayBuffer) {
                const fps = computeFps();
                const store = useTrackingStore.getState();

                // Revoke previous blob URL to avoid memory leak
                const prevFrame = store.currentFrame;
                if (prevFrame?.startsWith('blob:')) {
                    URL.revokeObjectURL(prevFrame);
                }

                const blob = new Blob([event.data], { type: 'image/jpeg' });
                store.setCurrentFrame(URL.createObjectURL(blob));

                // Update FPS in stats
                store.setStats({ ...store.stats, fps });
                return;
            }

            // ── Text message → JSON (metadata + optional base64 frame) ───
            if (typeof event.data === 'string') {
                try {
                    const data: WsPayload = JSON.parse(event.data);
                    const store = useTrackingStore.getState();
                    const fps = computeFps();

                    // frame_image present as string → base64 encoded JPEG
                    if (typeof data.frame_image === 'string' && data.frame_image.length > 0) {
                        store.setCurrentFrame(`data:image/jpeg;base64,${data.frame_image}`);
                    }

                    const objects = data.objects ?? [];
                    const frameW = data.width_frame ?? 1280;
                    const frameH = data.height_frame ?? 720;
                    const mapW = data.width_2D ?? 500;
                    const mapH = data.height_2D ?? 500;

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
                        person_count: objects.length,
                        person_count_change: 0,
                        entry_today: data.count_in ?? 0,
                        exit_today: data.count_out ?? 0,
                        fps,
                        behavior_distribution: { walking: 0, standing: 0, loitering: 0, other: 0 },
                        throughput: store.stats.throughput,
                    });
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
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        connect();
        return () => {
            mountedRef.current = false;
            clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
            // Revoke any remaining blob URL
            const frame = useTrackingStore.getState().currentFrame;
            if (frame?.startsWith('blob:')) URL.revokeObjectURL(frame);
        };
    }, [connect]);
}
