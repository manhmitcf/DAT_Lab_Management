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
    totalEventsToday: 12482,
    eventsChange: 12.4,
    avgConfidence: 98.2,
    confidenceChange: -0.5,
    peakTime: '14:30',
    peakOccupancy: 84,
    peakZone: 'Main Atrium',
    systemUptime: 99.9,
    alertDistribution: {
        loitering: { count: 482, percentage: 40 },
        fall: { count: 124, percentage: 10 },
        areaBreach: { count: 434, percentage: 35 },
        other: { count: 200, percentage: 15 },
    },
    behaviorTrends: [
        { time: '00:00', walking: 250, standing: 50, falls: 10 },
        { time: '06:00', walking: 180, standing: 120, falls: 5 },
        { time: '12:00', walking: 40, standing: 260, falls: 5 },
        { time: '18:00', walking: 60, standing: 190, falls: 20 },
        { time: '23:59', walking: 250, standing: 50, falls: 10 },
    ],
};
