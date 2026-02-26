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
        <div className="flex items-center gap-0.5 bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-1">
            {layouts.map((layout) => (
                <button
                    key={layout.count}
                    onClick={() => onLayoutChange(layout.count)}
                    className={`
                        flex items-center justify-center size-8 rounded-[var(--radius-sm)] transition-all duration-[var(--duration-fast)]
                        active:scale-95
                        ${selectedLayout === layout.count
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-text-tertiary hover:bg-surface-3 hover:text-text-primary'
                        }
                    `}
                    title={layout.label}
                    aria-label={layout.label}
                >
                    <span className="material-symbols-outlined text-lg">{layout.icon}</span>
                </button>
            ))}
        </div>
    );
}
