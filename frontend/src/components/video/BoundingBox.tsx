'use client';

import { Person } from '@/types';
import PoseOverlay from './PoseOverlay';

interface BoundingBoxProps {
    person: Person;
    showSkeleton?: boolean;
}

export default function BoundingBox({ person, showSkeleton = true }: BoundingBoxProps) {
    const { bbox, track_id, confidence, behavior } = person;

    // Convert normalized coordinates to percentages
    const style = {
        left: `${bbox.x * 100}%`,
        top: `${bbox.y * 100}%`,
        width: `${bbox.width * 100}%`,
        height: `${bbox.height * 100}%`,
    };

    const formatConfidence = (conf: number) => {
        return `${(conf * 100).toFixed(1)}%`;
    };

    const getBehaviorColor = (behavior: string) => {
        switch (behavior) {
            case 'falling':
            case 'fighting':
                return 'bg-[#ef4444]/90 text-white';
            case 'loitering':
                return 'bg-[#f59e0b]/90 text-white';
            default:
                return 'bg-[#137fec]/90 text-white';
        }
    };

    return (
        <div
            className="absolute border-2 border-[#137fec]/60 bg-[#137fec]/5 rounded-sm"
            style={style}
        >
            {/* Header badge with ID and confidence */}
            <div className="absolute -top-6 left-0 bg-[#137fec]/90 text-[10px] font-mono px-2 py-0.5 rounded-t-sm flex items-center gap-1">
                <span className="font-bold text-white">HUMAN #{track_id}</span>
                <span className="text-white/70">{formatConfidence(confidence)}</span>
            </div>

            {/* Behavior label */}
            {behavior && (
                <div className={`absolute -bottom-5 left-0 text-[9px] font-mono px-2 py-0.5 rounded-sm uppercase ${getBehaviorColor(behavior)}`}>
                    {behavior}
                </div>
            )}

            {/* Skeleton overlay */}
            {showSkeleton && <PoseOverlay person={person} />}
        </div>
    );
}
