'use client';

interface CameraLayoutSelectorProps {
    selectedLayout: number;
    onLayoutChange: (layout: number) => void;
}

const layouts = [
    { count: 1, icon: 'crop_square', label: '1 Camera' },
    { count: 2, icon: 'view_column', label: '2 Cameras' },
    { count: 4, icon: 'grid_view', label: '2×2 Grid' },
    { count: 6, icon: 'view_comfy', label: '3×2 Grid' },
    { count: 9, icon: 'apps', label: '3×3 Grid' },
];

export default function CameraLayoutSelector({ selectedLayout, onLayoutChange }: CameraLayoutSelectorProps) {
    return (
        <div className="flex items-center gap-1 bg-[#1B2431] border border-[#2a3441] rounded-lg p-1">
            {layouts.map((layout) => (
                <button
                    key={layout.count}
                    onClick={() => onLayoutChange(layout.count)}
                    className={`flex items-center justify-center size-9 rounded-md transition-all ${selectedLayout === layout.count
                            ? 'bg-[#137fec] text-white shadow-lg shadow-[#137fec]/20'
                            : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                    title={layout.label}
                >
                    <span className="material-symbols-outlined text-lg">{layout.icon}</span>
                </button>
            ))}
        </div>
    );
}
