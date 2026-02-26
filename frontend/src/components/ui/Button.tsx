import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    icon?: string;
    children: React.ReactNode;
}

const variantStyles: Record<string, string> = {
    primary: 'bg-accent text-white hover:bg-accent-strong shadow-sm',
    secondary: 'bg-surface-3 border border-border-default text-text-primary hover:bg-surface-4',
    ghost: 'bg-transparent text-text-secondary hover:bg-surface-3 hover:text-text-primary',
    danger: 'bg-danger text-white hover:brightness-110',
};

const sizeStyles: Record<string, string> = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
};

export default function Button({
    variant = 'secondary',
    size = 'sm',
    icon,
    children,
    className = '',
    ...props
}: ButtonProps) {
    return (
        <button
            className={`
                inline-flex items-center justify-center font-medium rounded-[var(--radius-md)]
                transition-all duration-[var(--duration-fast)]
                active:scale-[0.97]
                ${variantStyles[variant]}
                ${sizeStyles[size]}
                ${className}
            `}
            {...props}
        >
            {icon && <span className="material-symbols-outlined text-lg">{icon}</span>}
            {children}
        </button>
    );
}
