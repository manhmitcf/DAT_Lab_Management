/** Backend origin — keep in sync with API docs */
export const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE ??
    'https://labmanagementbackend-hte4hyczd0fef4ah.eastasia-01.azurewebsites.net';

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
