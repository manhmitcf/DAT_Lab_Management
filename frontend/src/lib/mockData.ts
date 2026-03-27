import { EdgeDevice, Alert, CameraFeed, DashboardStats } from '@/types';

// Dashboard statistics mock data
export const dashboardStats: DashboardStats = {
    activeCameras: 0,
    totalCameras: 0,
    cameraChange: 0,
    peopleTracked: 0,
    peopleChange: 0,
    totalAlerts: 0,
    criticalAlerts: 0,
    avgGpuLoad: 0,
    totalDetections: 0,
};

// Edge devices mock data
export const edgeDevices: EdgeDevice[] = [];

// Alerts mock data
export const alerts: Alert[] = [];

// Camera feeds mock data
export const cameraFeeds: CameraFeed[] = [];

// Detection activity data for chart (24h)
export const detectionActivity = [
    { hour: '00:00', count: 0 },
    { hour: '02:00', count: 0 },
    { hour: '04:00', count: 0 },
    { hour: '06:00', count: 0 },
    { hour: '08:00', count: 0 },
    { hour: '10:00', count: 0 },
    { hour: '12:00', count: 0 },
    { hour: '14:00', count: 0 },
    { hour: '16:00', count: 0 },
    { hour: '18:00', count: 0 },
    { hour: '20:00', count: 0 },
    { hour: '22:00', count: 0 },
];

// Analytics data — fallback when API fails (all zeros)
const ZERO_HOURS = Array(24).fill(0);
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const analyticsData = {
    // GET /analytics/summary
    summary: {
        current_occupancy: 0,
        peak_occupancy: 0,
        peak_time: '',
        avg_dwell_time_minutes: 0,
        total_in: 0,
        total_out: 0,
        net_flow: 0,
    },
    // GET /analytics/occupancy-trends
    occupancyTrends: {
        current: HOUR_LABELS.map((time) => ({ time, occupancy: 0, entry: 0, exit: 0 })),
        previous: HOUR_LABELS.map((time) => ({ time, occupancy: 0, entry: 0, exit: 0 })),
    },
    // GET /analytics/heatmap
    heatmap: DAY_NAMES.map((day) => ({ day, hours: [...ZERO_HOURS] })),
    // GET /analytics/traffic-daily
    trafficDaily: DAY_NAMES.map((day) => ({ day, total_in: 0, total_out: 0 })),
    // GET /analytics/flow-ratio
    flowRatio: {
        entry_exit: { total_in: 0, total_out: 0, in_percentage: 0, out_percentage: 0 },
        dwell_distribution: [
            { range: '< 5 min', percentage: 0 },
            { range: '5-15 min', percentage: 0 },
            { range: '15-30 min', percentage: 0 },
            { range: '> 30 min', percentage: 0 },
        ],
    },
    // GET /analytics/peak-daily
    peakDaily: DAY_NAMES.map((day) => ({ day, peak: 0, time: '' })),
    // GET /analytics/cumulative-traffic
    cumulativeTraffic: HOUR_LABELS.map((time) => ({ time, cumulative_in: 0, cumulative_out: 0 })),
};
