'use client';

import { useMemo } from 'react';
import { useTrackingStore } from '@/stores/trackingStore';

const W = 160;
const H = 40;
const PAD = 4;

/** Mini line chart (same idea as Analytics occupancy trend — compact for Live header). */
export default function MiniOccupancyChart() {
    const series = useTrackingStore((s) => s.occupancyHistory);

    const { path, areaPath, maxY } = useMemo(() => {
        const pts = series.length > 0 ? series : [0];
        const max = Math.max(...pts, 1);
        const min = 0;
        const range = max - min || 1;
        const innerW = W - PAD * 2;
        const innerH = H - PAD * 2;
        const step = pts.length > 1 ? innerW / (pts.length - 1) : innerW;
        const coords = pts.map((v, i) => {
            const x = PAD + i * step;
            const y = PAD + innerH - ((v - min) / range) * innerH;
            return { x, y };
        });
        const d = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const area =
            coords.length > 0
                ? `${d} L${coords[coords.length - 1].x.toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`
                : '';
        return { path: d, areaPath: area, maxY: max };
    }, [series]);

    return (
        <div
            className="flex flex-col items-end justify-center shrink-0 pl-2"
            title={`Occupancy trend (max ${Math.round(maxY)})`}
        >
            <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-0.5 w-full text-right pr-0.5">
                Occupancy trend
            </p>
            <svg width={W} height={H} className="overflow-visible" aria-hidden>
                <defs>
                    <linearGradient id="miniOccGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#137fec" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#137fec" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {areaPath && <path d={areaPath} fill="url(#miniOccGrad)" />}
                <path
                    d={path}
                    fill="none"
                    stroke="#137fec"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
        </div>
    );
}
