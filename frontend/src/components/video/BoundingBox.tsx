'use client';

import { Person } from '@/types';
import PoseOverlay from './PoseOverlay';

interface BoundingBoxProps {
    person: Person;
    showSkeleton?: boolean;
}

export default function BoundingBox({ person, showSkeleton = true }: BoundingBoxProps) {
    const { bbox, track_id, confidence, behavior } = person;

    const style = {
        left: `${bbox.x * 100}%`,
        top: `${bbox.y * 100}%`,
        width: `${bbox.width * 100}%`,
        height: `${bbox.height * 100}%`,
    };

    const formatConfidence = (conf: number) => `${(conf * 100).toFixed(1)}%`;

    const getBehaviorColor = (b: string) => {
        switch (b) {
            case 'falling':
            case 'fighting':
                return 'bg-danger/90 text-white';
            case 'loitering':
                return 'bg-warning/90 text-white';
            default:
                return 'bg-accent/90 text-white';
        }
    };

    return (
        <div className="absolute border-2 border-accent/60 bg-accent/5 rounded-sm" style={style}>
            <div className="absolute -top-6 left-0 bg-accent/90 text-[10px] font-mono px-2 py-0.5 rounded-t-sm flex items-center gap-1">
                <span className="font-bold text-white">HUMAN #{track_id}</span>
                <span className="text-white/70">{formatConfidence(confidence)}</span>
            </div>

            {behavior && (
                <div className={`absolute -bottom-5 left-0 text-[9px] font-mono px-2 py-0.5 rounded-sm uppercase ${getBehaviorColor(behavior)}`}>
                    {behavior}
                </div>
            )}

            {showSkeleton && <PoseOverlay person={person} />}
        </div>
    );
}
