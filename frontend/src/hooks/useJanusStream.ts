'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { JANUS_URL, JANUS_MOUNTPOINT_ID } from '@/config/api';

export type JanusStatus = 'idle' | 'loading' | 'connecting' | 'connected' | 'error';

/** Giống thứ tự trong index.html — jQuery, adapter, janus 1.3.0 */
const SCRIPTS = [
    'https://code.jquery.com/jquery-3.7.1.min.js',
    'https://webrtc.github.io/adapter/adapter-latest.js',
    'https://cdn.jsdelivr.net/npm/janus-gateway@1.3.0/npm/src/janus.js',
];

const JANUS_DEBUG = process.env.NEXT_PUBLIC_JANUS_DEBUG === 'true';

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
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [status, setStatus] = useState<JanusStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [videoMounted, setVideoMounted] = useState(false);
    const janusRef = useRef<unknown>(null);
    const streamingRef = useRef<unknown>(null);

    const setRef = useCallback((el: HTMLVideoElement | null) => {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
        setVideoMounted(!!el);
    }, []);

    useEffect(() => {
        if (!JANUS_URL || !videoMounted) return;
        const video = videoRef.current;
        if (!video) return;

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
                    debug: JANUS_DEBUG ? 'all' : 'none',
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
                                    error: (err: string) => {
                                        if (!cancelled) {
                                            setError(err || 'Plugin attach failed');
                                            setStatus('error');
                                        }
                                    },
                                    onmessage: (msg: any, jsep: RTCSessionDescriptionInit | null) => {
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
                                        const Janus = (window as any).Janus;
                                        if (Janus?.attachMediaStream) {
                                            Janus.attachMediaStream(video, stream);
                                        } else {
                                            video.srcObject = stream;
                                            video.play().catch(() => {});
                                        }
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
    }, [JANUS_URL, JANUS_MOUNTPOINT_ID, videoMounted]);

    return { videoRef: setRef, status, error };
}
