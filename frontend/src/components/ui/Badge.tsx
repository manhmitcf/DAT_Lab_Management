interface BadgeProps {
    children: React.ReactNode;
    variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
    size?: 'sm' | 'md';
    pulse?: boolean;
    className?: string;
}

const variantStyles: Record<string, string> = {
    success: 'bg-success-muted text-success',
    danger: 'bg-danger-muted text-danger',
    warning: 'bg-warning-muted text-warning',
    info: 'bg-accent-muted text-accent-strong',
    neutral: 'bg-surface-3 text-text-secondary',
};

export default function Badge({
    children,
    variant = 'neutral',
    size = 'sm',
    pulse = false,
    className = '',
}: BadgeProps) {
    return (
        <span
            className={`
                inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-full
                ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}
                ${variantStyles[variant]}
                ${pulse ? 'animate-pulse-subtle' : ''}
                ${className}
            `}
        >
            {children}
        </span>
    );
}
