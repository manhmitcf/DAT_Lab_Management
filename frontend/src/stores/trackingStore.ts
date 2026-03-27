import { create } from 'zustand';
import { analyticsData } from '@/lib/mockData';
import { Person, Detection, SystemStats, FloorPlanMarker } from '@/types';

const OCC_HISTORY_MAX = 48;
const initialOccupancyHistory = analyticsData.occupancyTrends.current.map((d) => d.occupancy);

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

    /** Video frame URL (legacy JPEG over WS, or env/WebRTC stream URL resolved in VideoPlayer) */
    currentFrame: string | null;
    setCurrentFrame: (frame: string | null) => void;

    // Alert level from WebSocket
    alertLevel: AlertLevel;
    setAlertLevel: (level: AlertLevel) => void;

    // WebSocket connection status
    wsStatus: WsStatus;
    setWsStatus: (status: WsStatus) => void;

    /** Rolling occupancy samples for Live header mini chart (synced with WS / seed from analytics mock) */
    occupancyHistory: number[];
    pushOccupancySample: (value: number) => void;
}

// Initial mock data
const initialStats: SystemStats = {
    person_count: 0,
    person_count_change: 0,
    entry_today: 0,
    exit_today: 0,
    fps: 0,
    behavior_distribution: {
        walking: 0,
        standing: 0,
        loitering: 0,
        other: 0,
    },
    throughput: [0, 0, 0, 0, 0, 0, 0, 0],
};

const initialPersons: Person[] = [];

const initialDetections: Detection[] = [];

const initialMarkers: FloorPlanMarker[] = [];

export const useTrackingStore = create<TrackingState>((set) => ({
    persons: initialPersons,
    setPersons: (persons) => set({ persons }),

    detections: initialDetections,
    addDetection: (detection) => set((state) => ({
        detections: [detection, ...state.detections].slice(0, 50),
    })),
    addDetection: (detection) => set((state) => ({
        detections: [detection, ...state.detections].slice(0, 50),
    })),
    clearDetections: () => set({ detections: [] }),

    stats: initialStats,
    setStats: (stats) => set({ stats }),

    markers: initialMarkers,
    setMarkers: (markers) => set({ markers }),

    selectedPersonId: null,
    setSelectedPersonId: (id) => set({ selectedPersonId: id }),

    isOnline: false,
    setIsOnline: (status) => set({ isOnline: status }),

    currentFrame: null,
    setCurrentFrame: (frame) => set({ currentFrame: frame }),

    alertLevel: 'none',
    setAlertLevel: (level) => set({ alertLevel: level }),

    wsStatus: 'disconnected',
    setWsStatus: (status) => set({ wsStatus: status }),

    occupancyHistory: initialOccupancyHistory,
    pushOccupancySample: (value) =>
        set((state) => ({
            occupancyHistory: [...state.occupancyHistory.slice(-(OCC_HISTORY_MAX - 1)), value],
        })),
}));
