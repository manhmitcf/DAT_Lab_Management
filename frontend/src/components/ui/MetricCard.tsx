interface MetricCardProps {
    label: string;
    icon: string;
    iconColor?: string;
    children: React.ReactNode;
    className?: string;
}

export default function MetricCard({
    label,
    icon,
    iconColor = 'text-accent',
    children,
    className = '',
}: MetricCardProps) {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div className={`size-8 rounded-[var(--radius-sm)] bg-surface-3 flex items-center justify-center shrink-0`}>
                <span className={`material-symbols-outlined text-lg ${iconColor}`}>{icon}</span>
            </div>
            <div className="min-w-0">
                <p className="text-[10px] text-text-tertiary uppercase font-medium tracking-wider leading-none mb-1">{label}</p>
                <div className="text-text-primary font-semibold text-sm leading-none">
                    {children}
                </div>
            </div>
        </div>
    );
}
