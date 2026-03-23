'use client';

import { useEffect, useRef, useState } from 'react';
import { JANUS_URL, JANUS_MOUNTPOINT_ID } from '@/config/api';

declare global {
    interface Window {
        Janus?: {
            init: (opts: { debug?: string; callback: () => void }) => void;
            attachMediaStream: (element: HTMLVideoElement, stream: MediaStream) => void;
        };
    }
}

export type JanusStatus = 'idle' | 'loading' | 'connecting' | 'connected' | 'error';

const SCRIPTS = [
    'https://code.jquery.com/jquery-3.7.1.min.js',
    'https://webrtc.github.io/adapter/adapter-latest.js',
    'https://cdn.jsdelivr.net/npm/janus-gateway@1.4.0/npm/src/janus.js',
];

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
    });
}

export function useJanusStream() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState<JanusStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const janusRef = useRef<unknown>(null);
    const streamingRef = useRef<unknown>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !JANUS_URL) return;

        let cancelled = false;

        const run = async () => {
            setStatus('loading');
            setError(null);
            try {
                for (const src of SCRIPTS) {
                    if (cancelled) return;
                    await loadScript(src);
                }
                if (cancelled) return;

                const Janus = (window as any).Janus;
                if (!Janus) {
                    throw new Error('Janus not loaded');
                }

                setStatus('connecting');
                Janus.init({
                    debug: 'none',
                    callback: () => {
                        if (cancelled) return;
                        janusRef.current = new Janus({
                            server: JANUS_URL,
                            success: () => {
                                if (cancelled) return;
                                (janusRef.current as any).attach({
                                    plugin: 'janus.plugin.streaming',
                                    success: (pluginHandle: any) => {
                                        if (cancelled) return;
                                        streamingRef.current = pluginHandle;
                                        pluginHandle.send({
                                            message: { request: 'watch', id: JANUS_MOUNTPOINT_ID },
                                        });
                                    },
                                    onmessage: (msg: unknown, jsep: RTCSessionDescriptionInit | null) => {
                                        if (cancelled || !jsep) return;
                                        const plugin = streamingRef.current as any;
                                        if (!plugin) return;
                                        plugin.createAnswer({
                                            jsep,
                                            media: { audioSend: false, videoSend: false },
                                            success: (answerJsep: RTCSessionDescriptionInit) => {
                                                plugin.send({ message: { request: 'start' }, jsep: answerJsep });
                                            },
                                        });
                                    },
                                    onremotetrack: (track: MediaStreamTrack, _mid: string, on: boolean) => {
                                        if (cancelled || !on || track.kind !== 'video') return;
                                        if (!video) return;
                                        const stream = new MediaStream([track]);
                                        Janus.attachMediaStream(video, stream);
                                        setStatus('connected');
                                    },
                                });
                            },
                            error: (err: string) => {
                                if (!cancelled) {
                                    setError(err || 'Janus connection failed');
                                    setStatus('error');
                                }
                            },
                        });
                    },
                });
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Failed to init Janus');
                    setStatus('error');
                }
            }
        };

        run();
        return () => {
            cancelled = true;
            const j = janusRef.current as any;
            if (j && j.destroy) j.destroy();
        };
    }, [JANUS_URL, JANUS_MOUNTPOINT_ID]);

    return { videoRef, status, error };
}
