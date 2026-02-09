'use client';

import { Person } from '@/types';

interface PoseOverlayProps {
    person: Person;
}

// Skeleton connections: pairs of keypoint indices to draw lines between
const SKELETON_CONNECTIONS = [
    [0, 1], // head to neck
    [1, 2], // neck to left shoulder
    [1, 3], // neck to right shoulder
    [1, 4], // neck to hip
    [4, 5], // hip to left leg
    [4, 6], // hip to right leg
];

export default function PoseOverlay({ person }: PoseOverlayProps) {
    const keypoints = person.keypoints;

    if (!keypoints || keypoints.length === 0) return null;

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ strokeWidth: 2 }}
        >
            {/* Draw keypoint circles */}
            {keypoints.map((kp, index) => (
                <circle
                    key={`point-${index}`}
                    cx={`${kp.x * 100}%`}
                    cy={`${kp.y * 100}%`}
                    r="4"
                    fill="#137fec"
                    opacity={kp.confidence > 0.5 ? 1 : 0.5}
                />
            ))}

            {/* Draw skeleton lines */}
            {SKELETON_CONNECTIONS.map(([startIdx, endIdx], index) => {
                const start = keypoints[startIdx];
                const end = keypoints[endIdx];

                if (!start || !end) return null;

                return (
                    <line
                        key={`line-${index}`}
                        x1={`${start.x * 100}%`}
                        y1={`${start.y * 100}%`}
                        x2={`${end.x * 100}%`}
                        y2={`${end.y * 100}%`}
                        stroke="#137fec"
                        strokeWidth="2"
                        opacity={Math.min(start.confidence, end.confidence) > 0.5 ? 1 : 0.5}
                    />
                );
            })}
        </svg>
    );
}
