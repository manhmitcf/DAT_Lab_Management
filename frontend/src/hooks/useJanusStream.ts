'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { JANUS_URL, JANUS_MOUNTPOINT_ID } from '@/config/api';

export type JanusStatus = 'idle' | 'loading' | 'connecting' | 'connected' | 'error';

const SCRIPTS = [
    'https://code.jquery.com/jquery-3.7.1.min.js',
    'https://webrtc.github.io/adapter/adapter-latest.js',
    'https://cdn.jsdelivr.net/npm/janus-gateway@1.3.0/npm/src/janus.js',
];

const JANUS_DEBUG = process.env.NEXT_PUBLIC_JANUS_DEBUG === 'true';

// Global state to track script loading status across hook instances
let scriptsLoadingPromise: Promise<void> | null = null;

function loadScripts(): Promise<void> {
    if (scriptsLoadingPromise) return scriptsLoadingPromise;

    scriptsLoadingPromise = (async () => {
        for (const src of SCRIPTS) {
            await new Promise<void>((resolve, reject) => {
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
    })();

    return scriptsLoadingPromise;
}

export function useJanusStream() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [status, setStatus] = useState<JanusStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    
    // Internal refs to keep Janus session alive across re-renders
    const janusRef = useRef<any>(null);
    const streamingRef = useRef<any>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const isRunningRef = useRef(false);

    // Attach current stream to the provided video element
    const attachToElement = useCallback((el: HTMLVideoElement | null) => {
        videoRef.current = el;
        if (el && remoteStreamRef.current) {
            const Janus = (window as any).Janus;
            if (Janus?.attachMediaStream) {
                Janus.attachMediaStream(el, remoteStreamRef.current);
            } else {
                el.srcObject = remoteStreamRef.current;
                el.play().catch(() => {});
            }
        }
    }, []);

    useEffect(() => {
        if (!JANUS_URL || isRunningRef.current) return;
        isRunningRef.current = true;

        let cancelled = false;

        const initJanus = async () => {
            setStatus('loading');
            setError(null);
            try {
                await loadScripts();
                if (cancelled) return;

                const Janus = (window as any).Janus;
                if (!Janus) throw new Error('Janus not loaded');

                setStatus('connecting');
                
                // Only init once globally if needed (Janus.init is usually safe called multiple times, but let's be careful)
                if (!(window as any).JanusInitialized) {
                    await new Promise<void>(resolve => {
                        Janus.init({
                            debug: JANUS_DEBUG ? 'all' : 'none',
                            callback: () => {
                                (window as any).JanusInitialized = true;
                                resolve();
                            }
                        });
                    });
                }

                if (cancelled) return;

                janusRef.current = new Janus({
                    server: JANUS_URL,
                    success: () => {
                        if (cancelled) return;
                        janusRef.current.attach({
                            plugin: 'janus.plugin.streaming',
                            success: (pluginHandle: any) => {
                                if (cancelled) return;
                                streamingRef.current = pluginHandle;
                                pluginHandle.send({
                                    message: { request: 'watch', id: JANUS_MOUNTPOINT_ID },
                                });
                            },
                            error: (err: any) => {
                                if (!cancelled) {
                                    setError(err?.message || err || 'Plugin attach failed');
                                    setStatus('error');
                                }
                            },
                            onmessage: (msg: any, jsep: any) => {
                                if (cancelled || !jsep) return;
                                const plugin = streamingRef.current;
                                if (!plugin) return;
                                plugin.createAnswer({
                                    jsep,
                                    media: { audioSend: false, videoSend: false },
                                    success: (answerJsep: any) => {
                                        plugin.send({ message: { request: 'start' }, jsep: answerJsep });
                                    },
                                    error: (err: any) => {
                                        console.error('Janus createAnswer error:', err);
                                    }
                                });
                            },
                            onremotetrack: (track: MediaStreamTrack, _mid: string, on: boolean) => {
                                if (cancelled || !on || track.kind !== 'video') return;
                                
                                const stream = new MediaStream([track]);
                                remoteStreamRef.current = stream;
                                setStatus('connected');

                                // If the video element is already provided, attach it
                                if (videoRef.current) {
                                    const Janus = (window as any).Janus;
                                    if (Janus?.attachMediaStream) {
                                        Janus.attachMediaStream(videoRef.current, stream);
                                    } else {
                                        videoRef.current.srcObject = stream;
                                        videoRef.current.play().catch(() => {});
                                    }
                                }
                            },
                        });
                    },
                    error: (err: any) => {
                        if (!cancelled) {
                            setError(err?.message || err || 'Janus connection failed');
                            setStatus('error');
                        }
                    },
                    destroyed: () => {
                        if (!cancelled) {
                            setStatus('idle');
                            remoteStreamRef.current = null;
                        }
                    }
                });
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Failed to init Janus');
                    setStatus('error');
                }
            }
        };

        initJanus();

        return () => {
            cancelled = true;
            isRunningRef.current = false;
            if (janusRef.current) {
                janusRef.current.destroy();
                janusRef.current = null;
                streamingRef.current = null;
                remoteStreamRef.current = null;
            }
        };
    }, []); // Only run once on mount

    return { videoRef: attachToElement, status, error };
}
