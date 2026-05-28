interface StatusDotProps {
    status?: 'online' | 'offline' | 'warning';
    size?: 'sm' | 'md';
    label?: string;
    className?: string;
}

const colorMap: Record<string, string> = {
    online: 'bg-success',
    offline: 'bg-danger',
    warning: 'bg-warning',
};

const pingMap: Record<string, string> = {
    online: 'bg-success',
    offline: 'bg-danger',
    warning: 'bg-warning',
};

export default function StatusDot({
    status = 'online',
    size = 'sm',
    label,
    className = '',
}: StatusDotProps) {
    const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';

    return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
            <span className="relative flex" style={{ width: size === 'sm' ? 8 : 10, height: size === 'sm' ? 8 : 10 }}>
                {status === 'online' && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pingMap[status]} opacity-50`} />
                )}
                <span className={`relative inline-flex rounded-full ${dotSize} ${colorMap[status]}`} />
            </span>
            {label && <span className="text-text-secondary text-xs font-medium">{label}</span>}
        </span>
    );
}
