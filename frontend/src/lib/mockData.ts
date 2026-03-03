import { EdgeDevice, Alert, CameraFeed, DashboardStats } from '@/types';

// Dashboard statistics mock data
export const dashboardStats: DashboardStats = {
    activeCameras: 12,
    totalCameras: 14,
    cameraChange: 2,
    peopleTracked: 45,
    peopleChange: 12,
    totalAlerts: 5,
    criticalAlerts: 1,
    avgGpuLoad: 78,
    totalDetections: 1240,
};

// Edge devices mock data
export const edgeDevices: EdgeDevice[] = [
    {
        id: 'jetson-01',
        name: 'Jetson Nano 01',
        type: 'jetson',
        status: 'online',
        cpuLoad: 45,
        ramUsed: 2.1,
        ramTotal: 4,
        fps: 32,
        temperature: 42,
    },
    {
        id: 'rpi-04',
        name: 'Raspberry Pi 04',
        type: 'raspberry',
        status: 'heavy',
        cpuLoad: 88,
        ramUsed: 3.8,
        ramTotal: 4,
        fps: 12,
        temperature: 65,
    },
    {
        id: 'server-02',
        name: 'Edge Server 02',
        type: 'server',
        status: 'offline',
        cpuLoad: 0,
        ramUsed: 0,
        ramTotal: 0,
        fps: 0,
        temperature: 0,
    },
    {
        id: 'jetson-02',
        name: 'Jetson Xavier NX',
        type: 'jetson',
        status: 'online',
        cpuLoad: 62,
        ramUsed: 5.2,
        ramTotal: 8,
        fps: 45,
        temperature: 48,
    },
];

// Alerts mock data
export const alerts: Alert[] = [
    {
        id: 'alert-1',
        type: 'critical',
        event: 'Crowded',
        start_time: '2026-02-28T14:32:15Z',
        end_time: '2026-02-28T14:35:15Z',
    },
    {
        id: 'alert-2',
        type: 'warning',
        event: 'Crowded',
        start_time: '2026-02-28T10:15:42Z',
        end_time: '2026-02-28T10:16:42Z',
    },
    {
        id: 'alert-3',
        type: 'critical',
        event: 'Crowded',
        start_time: '2026-02-28T09:05:00Z',
        end_time: '2026-02-28T09:12:30Z',
    },
    {
        id: 'alert-4',
        type: 'info',
        event: 'Crowded',
        start_time: '2026-02-27T16:45:10Z',
        end_time: '2026-02-27T16:46:25Z',
    },
    {
        id: 'alert-5',
        type: 'warning',
        event: 'Crowded',
        start_time: '2026-02-27T11:20:00Z',
        end_time: '2026-02-27T11:23:45Z',
    },
];

// Camera feeds mock data
export const cameraFeeds: CameraFeed[] = [
    {
        id: 'cam-01',
        name: 'CAM-01',
        location: 'Main Lobby',
        imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
        status: 'online',
        resolution: '4K',
    },
    {
        id: 'cam-02',
        name: 'CAM-02',
        location: 'East Wing Hallway',
        imageUrl: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80',
        status: 'online',
        resolution: '1080p',
    },
    {
        id: 'cam-03',
        name: 'CAM-03',
        location: 'Parking Level B1',
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
        status: 'online',
        resolution: '4K',
    },
    {
        id: 'cam-04',
        name: 'CAM-04',
        location: 'Server Room',
        imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80',
        status: 'heavy',
        resolution: '1080p',
    },
];

// Detection activity data for chart (24h)
export const detectionActivity = [
    { hour: '00:00', count: 45 },
    { hour: '02:00', count: 22 },
    { hour: '04:00', count: 15 },
    { hour: '06:00', count: 38 },
    { hour: '08:00', count: 120 },
    { hour: '10:00', count: 180 },
    { hour: '12:00', count: 210 },
    { hour: '14:00', count: 195 },
    { hour: '16:00', count: 165 },
    { hour: '18:00', count: 142 },
    { hour: '20:00', count: 88 },
    { hour: '22:00', count: 52 },
];

// Analytics data
export const analyticsData = {
    // GET /analytics/summary
    summary: {
        current_occupancy: 42,
        peak_occupancy: 84,
        peak_time: '14:30',
        avg_dwell_time_minutes: 23.5,
        total_in: 847,
        total_out: 743,
        net_flow: 104,
    },
    // GET /analytics/occupancy-trends
    occupancyTrends: {
        current: [
            { time: '00:00', occupancy: 12, ingress: 5, egress: 3 },
            { time: '02:00', occupancy: 8, ingress: 2, egress: 6 },
            { time: '04:00', occupancy: 5, ingress: 1, egress: 4 },
            { time: '06:00', occupancy: 15, ingress: 12, egress: 2 },
            { time: '08:00', occupancy: 45, ingress: 35, egress: 5 },
            { time: '10:00', occupancy: 68, ingress: 28, egress: 5 },
            { time: '12:00', occupancy: 52, ingress: 10, egress: 26 },
            { time: '14:00', occupancy: 84, ingress: 42, egress: 10 },
            { time: '16:00', occupancy: 62, ingress: 8, egress: 30 },
            { time: '18:00', occupancy: 35, ingress: 5, egress: 32 },
            { time: '20:00', occupancy: 18, ingress: 3, egress: 20 },
            { time: '22:00', occupancy: 10, ingress: 2, egress: 10 },
        ],
        previous: [
            { time: '00:00', occupancy: 15, ingress: 7, egress: 4 },
            { time: '02:00', occupancy: 10, ingress: 3, egress: 8 },
            { time: '04:00', occupancy: 6, ingress: 2, egress: 6 },
            { time: '06:00', occupancy: 18, ingress: 14, egress: 2 },
            { time: '08:00', occupancy: 50, ingress: 38, egress: 6 },
            { time: '10:00', occupancy: 72, ingress: 30, egress: 8 },
            { time: '12:00', occupancy: 55, ingress: 12, egress: 29 },
            { time: '14:00', occupancy: 78, ingress: 35, egress: 12 },
            { time: '16:00', occupancy: 58, ingress: 10, egress: 30 },
            { time: '18:00', occupancy: 30, ingress: 4, egress: 32 },
            { time: '20:00', occupancy: 15, ingress: 2, egress: 17 },
            { time: '22:00', occupancy: 8, ingress: 1, egress: 8 },
        ],
    },
    // GET /analytics/heatmap
    heatmap: [
        { day: 'Mon', hours: [0.05, 0.03, 0.02, 0.02, 0.08, 0.25, 0.55, 0.72, 0.85, 0.92, 0.88, 0.78, 0.82, 0.75, 0.68, 0.62, 0.70, 0.65, 0.45, 0.38, 0.30, 0.22, 0.15, 0.08] },
        { day: 'Tue', hours: [0.04, 0.02, 0.01, 0.02, 0.10, 0.30, 0.60, 0.75, 0.88, 0.95, 0.90, 0.80, 0.85, 0.78, 0.70, 0.65, 0.72, 0.68, 0.48, 0.40, 0.32, 0.25, 0.18, 0.10] },
        { day: 'Wed', hours: [0.06, 0.04, 0.02, 0.03, 0.12, 0.35, 0.62, 0.80, 0.90, 0.98, 0.92, 0.85, 0.88, 0.82, 0.75, 0.70, 0.78, 0.72, 0.52, 0.42, 0.35, 0.28, 0.20, 0.12] },
        { day: 'Thu', hours: [0.05, 0.03, 0.02, 0.02, 0.10, 0.28, 0.58, 0.74, 0.86, 0.94, 0.88, 0.80, 0.84, 0.76, 0.70, 0.64, 0.72, 0.66, 0.46, 0.38, 0.30, 0.24, 0.16, 0.09] },
        { day: 'Fri', hours: [0.06, 0.04, 0.03, 0.03, 0.12, 0.32, 0.60, 0.78, 0.88, 0.96, 0.90, 0.82, 0.86, 0.80, 0.72, 0.68, 0.75, 0.70, 0.50, 0.42, 0.34, 0.26, 0.18, 0.10] },
        { day: 'Sat', hours: [0.03, 0.02, 0.01, 0.01, 0.05, 0.15, 0.30, 0.42, 0.50, 0.55, 0.52, 0.48, 0.50, 0.46, 0.40, 0.35, 0.38, 0.32, 0.25, 0.20, 0.15, 0.10, 0.08, 0.05] },
        { day: 'Sun', hours: [0.02, 0.01, 0.01, 0.01, 0.03, 0.10, 0.20, 0.30, 0.35, 0.40, 0.38, 0.35, 0.36, 0.32, 0.28, 0.25, 0.28, 0.24, 0.18, 0.14, 0.10, 0.08, 0.05, 0.03] },
    ],
    // GET /analytics/traffic-daily
    trafficDaily: [
        { day: 'Mon', total_in: 120, total_out: 115 },
        { day: 'Tue', total_in: 145, total_out: 138 },
        { day: 'Wed', total_in: 160, total_out: 152 },
        { day: 'Thu', total_in: 135, total_out: 128 },
        { day: 'Fri', total_in: 155, total_out: 148 },
        { day: 'Sat', total_in: 75, total_out: 70 },
        { day: 'Sun', total_in: 55, total_out: 50 },
    ],
    // GET /analytics/flow-ratio
    flowRatio: {
        entry_exit: { total_in: 847, total_out: 743, in_percentage: 53.3, out_percentage: 46.7 },
        dwell_distribution: [
            { range: '< 5 min', percentage: 25 },
            { range: '5-15 min', percentage: 35 },
            { range: '15-30 min', percentage: 25 },
            { range: '> 30 min', percentage: 15 },
        ],
    },
};
