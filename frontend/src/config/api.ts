/** Backend origin — keep in sync with API docs */
const _base =
    process.env.NEXT_PUBLIC_API_BASE ??
    (typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
        ? ''
        : 'https://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net');
export const API_BASE = (_base ?? '').replace(/\/+$/, '') || '';
const wsOrigin = API_BASE.replace(/^http/, 'ws');

export const WS_URLS = {
    /** Edge → BE → FE metadata (JSON, no video) */
    persistMetadata: `${wsOrigin}/ws/persist/metadata/`,
    /** FE → BE → Edge mapping calibration */
    settingsMapping: `${wsOrigin}/ws/settings/mapping/`,
    /** FE → BE → Edge counting line */
    settingsCounting: `${wsOrigin}/ws/settings/counting/`,
} as const;

/**
 * Pixel size of floor plan used when mapping coordinates_2D → % overlay.
 * Should match `map_size` used in calibration (default in API doc: 1000×1000).
 */
export const FLOOR_PLAN_MAP_SIZE = { width: 1000, height: 1000 } as const;

/**
 * Janus WebRTC streaming — video từ camera qua Janus Gateway.
 * Set NEXT_PUBLIC_JANUS_URL để bật (ví dụ: wss://datwebrtc.eastasia.cloudapp.azure.com/janus).
 * Mountpoint: NEXT_PUBLIC_JANUS_MOUNTPOINT (default 1).
 */
export const JANUS_URL = process.env.NEXT_PUBLIC_JANUS_URL ?? '';
export const JANUS_MOUNTPOINT_ID = parseInt(
    process.env.NEXT_PUBLIC_JANUS_MOUNTPOINT ?? '1',
    10
);
