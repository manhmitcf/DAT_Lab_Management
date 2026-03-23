import { WS_URLS } from '@/config/api';

type SendResult = { ok: true } | { ok: false; errorMessage: string };

/**
 * Opens a short-lived WebSocket, sends one JSON payload (mapping or counting), waits for first response.
 * BE keeps connection open and returns JSON errors per API_Doc_BE.md.
 */
export function sendCalibrationPayload(
    channel: 'mapping' | 'counting',
    payload: unknown,
    timeoutMs = 12_000
): Promise<SendResult> {
    const url =
        channel === 'mapping' ? WS_URLS.settingsMapping : WS_URLS.settingsCounting;

    return new Promise((resolve) => {
        let settled = false;
        let ws: WebSocket | null = null;

        const finish = (r: SendResult) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
                ws?.close();
            } catch {
                /* ignore */
            }
            resolve(r);
        };

        const timer = setTimeout(
            () => finish({ ok: false, errorMessage: 'Request timed out' }),
            timeoutMs
        );

        try {
            ws = new WebSocket(url);
        } catch {
            clearTimeout(timer);
            resolve({ ok: false, errorMessage: 'Could not open WebSocket' });
            return;
        }

        ws.onopen = () => {
            try {
                ws!.send(JSON.stringify(payload));
            } catch {
                finish({ ok: false, errorMessage: 'Failed to send payload' });
            }
        };

        ws.onmessage = (ev: MessageEvent) => {
            if (typeof ev.data !== 'string') {
                finish({ ok: true });
                return;
            }
            try {
                const data = JSON.parse(ev.data) as {
                    error?: { code?: string; message?: string; details?: unknown };
                };
                if (data.error) {
                    const msg =
                        data.error.message ??
                        data.error.code ??
                        'Server rejected the payload';
                    finish({ ok: false, errorMessage: msg });
                    return;
                }
            } catch {
                /* non-JSON ack → treat as success */
            }
            finish({ ok: true });
        };

        ws.onerror = () => {
            finish({ ok: false, errorMessage: 'WebSocket error' });
        };
    });
}
