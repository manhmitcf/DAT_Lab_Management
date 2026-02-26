interface ProgressBarProps {
    value: number;
    color?: string;
    label?: string;
    showValue?: boolean;
    animate?: boolean;
    className?: string;
}

export default function ProgressBar({
    value,
    color = 'var(--accent)',
    label,
    showValue = true,
    animate = true,
    className = '',
}: ProgressBarProps) {
    return (
        <div className={className}>
            {(label || showValue) && (
                <div className="flex justify-between items-center mb-1.5">
                    {label && <span className="text-sm text-text-secondary">{label}</span>}
                    {showValue && <span className="text-sm font-medium text-text-primary font-mono">{value}%</span>}
                </div>
            )}
            <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full ${animate ? 'animate-bar-fill' : ''}`}
                    style={{ width: `${value}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}
