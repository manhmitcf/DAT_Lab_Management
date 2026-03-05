import React, { forwardRef } from 'react';

interface CardProps {
    children: React.ReactNode;
    variant?: 'default' | 'glass' | 'outlined' | 'featured';
    className?: string;
    hover?: boolean;
    padding?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
    default: 'bg-surface-2 border border-border-default',
    glass: 'bg-surface-2/60 backdrop-blur-md border border-border-subtle',
    outlined: 'bg-transparent border border-border-default',
    featured: 'bg-surface-2 border border-border-default border-l-[3px] border-l-accent',
};

const paddingStyles: Record<string, string> = {
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
};

const Card = forwardRef<HTMLDivElement, CardProps>(({
    children,
    variant = 'default',
    className = '',
    hover = false,
    padding = 'md',
}, ref) => {
    return (
        <div
            ref={ref}
            className={`
                rounded-[var(--radius-lg)]
                ${variantStyles[variant]}
                ${paddingStyles[padding]}
                ${hover ? 'hover-lift cursor-pointer' : ''}
                ${className}
            `}
        >
            {children}
        </div>
    );
});

Card.displayName = 'Card';

export default Card;
