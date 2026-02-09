// Person tracking data from AI detection
export interface Keypoint {
    x: number;
    y: number;
    confidence: number;
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Person {
    track_id: number;
    bbox: BoundingBox;
    keypoints: Keypoint[];
    behavior: 'walking' | 'standing' | 'running' | 'sitting' | 'falling' | 'loitering' | 'fighting';
    confidence: number;
    timestamp: string;
}

// Detection events
export type DetectionEventType = 'alert' | 'entry' | 'exit' | 'tracking';

export interface Detection {
    id: string;
    type: DetectionEventType;
    event: string;
    track_id: number;
    location: string;
    confidence: number;
    timestamp: string;
}

// System statistics
export interface SystemStats {
    active_cameras: number;
    total_cameras: number;
    person_count: number;
    person_count_change: number;
    metadata_rate: number;
    inference_time: number;
    behavior_distribution: {
        walking: number;
        standing: number;
        loitering: number;
        other: number;
    };
    throughput: number[];
}

// Camera configuration
export interface Camera {
    id: string;
    name: string;
    location: string;
    rtsp_url: string;
    status: 'online' | 'offline' | 'error';
}

// Floor plan marker
export interface FloorPlanMarker {
    id: number;
    x: number;
    y: number;
    type: 'active' | 'inactive' | 'alert';
    label?: string;
}

// Dashboard types
export interface DashboardStats {
    activeCameras: number;
    totalCameras: number;
    cameraChange: number;
    peopleTracked: number;
    peopleChange: number;
    totalAlerts: number;
    criticalAlerts: number;
    avgGpuLoad: number;
    totalDetections: number;
}

export interface EdgeDevice {
    id: string;
    name: string;
    type: 'jetson' | 'raspberry' | 'server';
    status: 'online' | 'offline' | 'heavy';
    cpuLoad: number;
    ramUsed: number;
    ramTotal: number;
    fps: number;
    temperature: number;
}

export interface Alert {
    id: string;
    type: 'critical' | 'high' | 'low';
    event: string;
    icon: string;
    camera: string;
    location: string;
    timestamp: string;
    confidence: number;
    resolved: boolean;
}

export interface CameraFeed {
    id: string;
    name: string;
    location: string;
    imageUrl: string;
    status: 'online' | 'offline' | 'heavy';
    resolution: string;
}

// Analytics types
export interface AnalyticsData {
    totalEventsToday: number;
    eventsChange: number;
    avgConfidence: number;
    confidenceChange: number;
    peakTime: string;
    peakOccupancy: number;
    peakZone: string;
    systemUptime: number;
    alertDistribution: {
        loitering: { count: number; percentage: number };
        fall: { count: number; percentage: number };
        areaBreach: { count: number; percentage: number };
        other: { count: number; percentage: number };
    };
}
