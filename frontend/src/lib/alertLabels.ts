import type { AlertLevel } from '@/stores/trackingStore';

/** Human-readable labels for WebSocket `alert` field (none | info | warning | critical). */
export const ALERT_LEVEL_DISPLAY: Record<
    AlertLevel,
    { short: string; description: string; textClass: string }
> = {
    none: {
        short: 'All clear',
        description: 'No active alerts',
        textClass: 'text-emerald-400',
    },
    info: {
        short: 'Normal',
        description: 'System operating normally',
        textClass: 'text-sky-400',
    },
    warning: {
        short: 'Warning',
        description: 'Attention required',
        textClass: 'text-amber-400',
    },
    critical: {
        short: 'Critical',
        description: 'Immediate action required',
        textClass: 'text-red-400',
    },
};

export function getAlertLevelDisplay(level: AlertLevel) {
    return ALERT_LEVEL_DISPLAY[level] ?? ALERT_LEVEL_DISPLAY.none;
}
