import { create } from 'zustand';
import { Person, Detection, SystemStats, FloorPlanMarker } from '@/types';

export type AlertLevel = 'none' | 'info' | 'warning' | 'critical';
export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface TrackingState {
    // Persons currently being tracked
    persons: Person[];
    setPersons: (persons: Person[]) => void;

    // Detection events log
    detections: Detection[];
    addDetection: (detection: Detection) => void;
    clearDetections: () => void;

    // System statistics
    stats: SystemStats;
    setStats: (stats: SystemStats) => void;

    // Floor plan markers
    markers: FloorPlanMarker[];
    setMarkers: (markers: FloorPlanMarker[]) => void;

    // Selected person for focus view
    selectedPersonId: number | null;
    setSelectedPersonId: (id: number | null) => void;

    // System status
    isOnline: boolean;
    setIsOnline: (status: boolean) => void;

    // Live video frame from WebSocket (base64 data URL)
    currentFrame: string | null;
    setCurrentFrame: (frame: string | null) => void;

    // Alert level from WebSocket
    alertLevel: AlertLevel;
    setAlertLevel: (level: AlertLevel) => void;

    // WebSocket connection status
    wsStatus: WsStatus;
    setWsStatus: (status: WsStatus) => void;
}

// Initial mock data
const initialStats: SystemStats = {
    person_count: 104,
    person_count_change: 5.2,
    entry_today: 847,
    exit_today: 743,
    fps: 30,
    behavior_distribution: {
        walking: 68,
        standing: 24,
        loitering: 8,
        other: 0,
    },
    throughput: [40, 60, 85, 45, 70, 95, 30, 50],
};

const initialPersons: Person[] = [
    {
        track_id: 42,
        bbox: { x: 0.42, y: 0.25, width: 0.12, height: 0.45 },
        keypoints: [
            { x: 0.5, y: 0.15, confidence: 0.99 },
            { x: 0.5, y: 0.35, confidence: 0.98 },
            { x: 0.3, y: 0.35, confidence: 0.95 },
            { x: 0.7, y: 0.35, confidence: 0.96 },
            { x: 0.5, y: 0.55, confidence: 0.97 },
            { x: 0.35, y: 0.85, confidence: 0.94 },
            { x: 0.65, y: 0.85, confidence: 0.93 },
        ],
        behavior: 'walking',
        confidence: 0.992,
        timestamp: new Date().toISOString(),
    },
];

const initialDetections: Detection[] = [
    {
        id: '1',
        type: 'alert',
        event: 'Posture Alert',
        track_id: 88,
        location: 'West Gate',
        confidence: 0.94,
        timestamp: '14:24:12',
    },
    {
        id: '2',
        type: 'entry',
        event: 'New Entry',
        track_id: 92,
        location: 'North Lobby',
        confidence: 0.98,
        timestamp: '14:23:55',
    },
    {
        id: '3',
        type: 'tracking',
        event: 'Tracking',
        track_id: 42,
        location: 'Moving to Zone B',
        confidence: 0.96,
        timestamp: '14:23:30',
    },
];

const initialMarkers: FloorPlanMarker[] = [
    { id: 42, x: 45, y: 35, type: 'active', label: 'Person #42 (Primary)' },
    { id: 88, x: 70, y: 45, type: 'inactive' },
    { id: 99, x: 25, y: 70, type: 'alert' },
];

export const useTrackingStore = create<TrackingState>((set) => ({
    persons: initialPersons,
    setPersons: (persons) => set({ persons }),

    detections: initialDetections,
    addDetection: (detection) => set((state) => ({
        detections: [detection, ...state.detections].slice(0, 50),
    })),
    clearDetections: () => set({ detections: [] }),

    stats: initialStats,
    setStats: (stats) => set({ stats }),

    markers: initialMarkers,
    setMarkers: (markers) => set({ markers }),

    selectedPersonId: 42,
    setSelectedPersonId: (id) => set({ selectedPersonId: id }),

    isOnline: false,
    setIsOnline: (status) => set({ isOnline: status }),

    currentFrame: null,
    setCurrentFrame: (frame) => set({ currentFrame: frame }),

    alertLevel: 'none',
    setAlertLevel: (level) => set({ alertLevel: level }),

    wsStatus: 'disconnected',
    setWsStatus: (status) => set({ wsStatus: status }),
}));
