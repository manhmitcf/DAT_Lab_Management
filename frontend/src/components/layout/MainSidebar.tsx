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

const bottomNavItems = [{ href: '/settings', icon: 'settings', label: 'Settings' }];

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
                flex shrink-0 flex-col justify-between border-r border-[#283039] bg-[#151b22]
                transition-[width] duration-200 ease-out
                ${isCollapsed ? 'w-[72px]' : 'w-[216px]'}
            `}
            aria-label="Main navigation"
        >
            <div className={`flex flex-col gap-1 pb-3 ${isCollapsed ? 'px-2 pt-3' : 'px-3 pt-3'}`}>
                {/* Narrow / expand — top of sidebar (easy to find, out of the nav flow) */}
                <button
                    type="button"
                    onClick={toggleSidebar}
                    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className={`
                        mb-3 flex w-full items-center rounded-lg border border-[#283039]/60 bg-[#1a222a]/40
                        text-gray-500 transition-colors hover:border-[#137fec]/25 hover:bg-[#1f2937] hover:text-gray-300
                        ${isCollapsed ? 'justify-center py-2.5' : 'justify-center gap-2 py-2 px-2'}
                    `}
                >
                    <span className="material-symbols-outlined text-[20px] text-gray-400">
                        {isCollapsed ? 'dock_to_left' : 'dock_to_right'}
                    </span>
                    {!isCollapsed && (
                        <span className="text-[11px] font-medium tracking-wide">Narrow menu</span>
                    )}
                </button>

                <div
                    className={`mb-4 flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-2'}`}
                >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#137fec]/15 text-[#137fec] ring-1 ring-[#137fec]/25">
                        <span className="material-symbols-outlined text-[22px]">shield_person</span>
                    </div>
                    {!isCollapsed && (
                        <div className="min-w-0">
                            <p className="truncate text-[13px] font-bold tracking-tight text-white">DAT Lab</p>
                            <p className="truncate text-[10px] font-medium uppercase tracking-wider text-gray-500">
                                Management
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-1">
                    {navItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={isCollapsed ? item.label : undefined}
                                className={`
                                    relative flex items-center rounded-xl transition-colors
                                    ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'}
                                    ${active
                                        ? 'bg-[#137fec]/12 text-white shadow-sm ring-1 ring-[#137fec]/20'
                                        : 'text-gray-400 hover:bg-[#1f2937] hover:text-gray-200'
                                    }
                                `}
                                aria-current={active ? 'page' : undefined}
                            >
                                {active && (
                                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#137fec]" />
                                )}
                                <span
                                    className={`material-symbols-outlined text-[22px] ${active ? 'text-[#137fec]' : ''}`}
                                >
                                    {item.icon}
                                </span>
                                {!isCollapsed && (
                                    <>
                                        <span className="flex-1 text-[13px] font-medium">{item.label}</span>
                                        {item.badge ? (
                                            <span className="flex min-w-[20px] items-center justify-center rounded-full bg-red-500/90 px-1.5 text-[10px] font-bold text-white">
                                                {item.badge}
                                            </span>
                                        ) : null}
                                    </>
                                )}
                                {isCollapsed && item.badge ? (
                                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                                        {item.badge}
                                    </span>
                                ) : null}
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className={`flex flex-col gap-1 border-t border-[#283039] p-3 ${isCollapsed ? 'px-2' : ''}`}>
                {bottomNavItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        title={isCollapsed ? item.label : undefined}
                        className={`
                            flex items-center rounded-xl transition-colors
                            ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'}
                            ${isActive(item.href)
                                ? 'bg-[#137fec]/12 text-white ring-1 ring-[#137fec]/20'
                                : 'text-gray-400 hover:bg-[#1f2937] hover:text-gray-200'
                            }
                        `}
                    >
                        <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                        {!isCollapsed && <span className="text-[13px] font-medium">{item.label}</span>}
                    </Link>
                ))}
                <button
                    type="button"
                    title={isCollapsed ? 'Log out' : undefined}
                    className={`
                        flex items-center rounded-xl text-gray-500 transition-colors hover:bg-[#1f2937] hover:text-gray-300
                        ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'}
                    `}
                    aria-label="Log out"
                >
                    <span className="material-symbols-outlined text-[22px]">logout</span>
                    {!isCollapsed && <span className="text-[13px] font-medium">Log out</span>}
                </button>
            </div>
        </nav>
    );
}
