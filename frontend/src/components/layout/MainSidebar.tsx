'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebarStore } from '@/stores/sidebarStore';

const navItems = [
    { href: '/', icon: 'monitoring', label: 'Live Monitor' },
    { href: '/analytics', icon: 'analytics', label: 'Analytics' },
    { href: '/alerts', icon: 'notifications', label: 'Alerts', badge: 3 },
    { href: '/history', icon: 'history', label: 'History' },
];

const bottomNavItems = [
    { href: '/settings', icon: 'settings', label: 'Settings' },
];

export default function MainSidebar() {
    const pathname = usePathname();
    const { isCollapsed, toggleSidebar } = useSidebarStore();

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <nav
            className={`
                ${isCollapsed ? 'w-[72px]' : 'w-[240px]'}
                flex flex-col justify-between bg-surface-1 border-r border-border-default flex-shrink-0
                transition-all duration-300 ease-[var(--ease-out)]
            `}
            aria-label="Main navigation"
        >
            <div className="flex flex-col gap-1 p-3">
                {/* Collapse toggle */}
                <button
                    onClick={toggleSidebar}
                    className="flex items-center justify-center p-2 rounded-[var(--radius-sm)] text-text-tertiary hover:bg-surface-3 hover:text-text-primary transition-colors self-end mb-2"
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <span className="material-symbols-outlined text-xl">
                        {isCollapsed ? 'chevron_right' : 'chevron_left'}
                    </span>
                </button>

                {/* Brand / User Profile Section */}
                <div className={`group flex items-center gap-3 ${isCollapsed ? 'justify-center' : 'px-2'} mb-8 cursor-pointer hover:bg-surface-2 p-1.5 rounded-[var(--radius-lg)] transition-all`}>
                    <div className="relative shrink-0">
                        <div
                            className="bg-center bg-no-repeat bg-cover rounded-full size-10 ring-2 ring-accent/30 group-hover:ring-accent transition-all shadow-lg"
                            style={{ backgroundImage: `url("https://ui-avatars.com/api/?name=Admin+User&background=3b82f6&color=fff&font-size=0.4&bold=true")` }}
                        />
                        <span className="absolute bottom-0 right-0 size-3 bg-success border-2 border-surface-1 rounded-full shadow-sm" title="Online" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex-col flex overflow-hidden">
                            <h1 className="text-text-primary text-[13px] font-bold leading-tight truncate">Admin User</h1>
                            <div className="flex items-center gap-1.5">
                                <span className="text-accent text-[10px] font-bold uppercase tracking-tighter">System Admin</span>
                                <span className="size-1 rounded-full bg-text-tertiary" />
                                <span className="text-success text-[10px] font-medium">Online</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Nav items */}
                <div className="flex flex-col gap-0.5">
                    {navItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    relative flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] group
                                    transition-all duration-[var(--duration-fast)]
                                    ${isCollapsed ? 'justify-center' : ''}
                                    ${active
                                        ? 'bg-accent/10 text-accent-strong'
                                        : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                                    }
                                `}
                                aria-label={isCollapsed ? item.label : undefined}
                                aria-current={active ? 'page' : undefined}
                            >
                                {/* Active accent bar */}
                                {active && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full animate-scale-in" />
                                )}

                                <span className={`material-symbols-outlined text-[22px] ${active ? 'font-bold' : ''}`}>
                                    {item.icon}
                                </span>

                                {!isCollapsed && (
                                    <>
                                        <p className="text-[13px] font-medium flex-1">{item.label}</p>
                                        {item.badge && (
                                            <span className="bg-danger text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full animate-pulse-subtle">
                                                {item.badge}
                                            </span>
                                        )}
                                    </>
                                )}

                                {isCollapsed && item.badge && (
                                    <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[8px] size-4 flex items-center justify-center rounded-full font-bold">
                                        {item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Bottom nav */}
            <div className="p-3 flex flex-col gap-0.5 border-t border-border-subtle">
                {bottomNavItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`
                            flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] group
                            transition-colors duration-[var(--duration-fast)]
                            ${isCollapsed ? 'justify-center' : ''}
                            ${isActive(item.href)
                                ? 'bg-accent/10 text-accent-strong'
                                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                            }
                        `}
                        aria-label={isCollapsed ? item.label : undefined}
                    >
                        <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                        {!isCollapsed && <p className="text-[13px] font-medium">{item.label}</p>}
                    </Link>
                ))}
                <button
                    className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)]
                        text-text-tertiary hover:bg-surface-2 hover:text-text-primary transition-colors
                        ${isCollapsed ? 'justify-center' : ''}
                    `}
                    aria-label="Logout"
                >
                    <span className="material-symbols-outlined text-[22px]">logout</span>
                    {!isCollapsed && <p className="text-[13px] font-medium">Logout</p>}
                </button>
            </div>
        </nav>
    );
}
