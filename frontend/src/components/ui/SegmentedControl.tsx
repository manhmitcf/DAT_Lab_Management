'use client';

interface SegmentedControlProps<T extends string> {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
}

export default function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    className = '',
}: SegmentedControlProps<T>) {
    return (
        <div className={`flex bg-surface-1 rounded-[var(--radius-md)] p-1 border border-border-default ${className}`}>
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`
                        px-4 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-all duration-[var(--duration-fast)]
                        ${value === option.value
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }
                    `}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
