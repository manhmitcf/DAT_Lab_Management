'use client';

import DetectionLog from '@/components/panels/DetectionLog';
import Analytics from '@/components/panels/Analytics';

export default function Sidebar() {
    return (
        <aside className="w-[320px] shrink-0 bg-[#111418] border-l border-[#283039] flex flex-col z-40">
            {/* Detection Log - Top Half */}
            <div className="flex flex-col h-1/2 border-b border-[#283039]">
                <DetectionLog />
            </div>

            {/* Analytics - Bottom Half */}
            <div className="flex-1 flex flex-col">
                <Analytics />
            </div>
        </aside>
    );
}
