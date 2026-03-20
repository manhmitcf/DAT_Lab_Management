'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    { href: '/', icon: 'monitoring', label: 'Live Monitor' },
    { href: '/analytics', icon: 'analytics', label: 'Analytics' },
    { href: '/alerts', icon: 'notifications', label: 'Alerts', badge: 3 },
    { href: '/history', icon: 'history', label: 'History' },
];

const bottomNavItems = [{ href: '/settings', icon: 'settings', label: 'Settings' }];

export default function MainSidebar() {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <nav
            className="flex w-[216px] shrink-0 flex-col justify-between border-r border-[#283039] bg-[#151b22]"
            aria-label="Main navigation"
        >
            <div className="flex flex-col gap-1 px-3 pt-5 pb-3">
                <div className="mb-6 flex items-center gap-3 px-2">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#137fec]/15 text-[#137fec] ring-1 ring-[#137fec]/25">
                        <span className="material-symbols-outlined text-[22px]">shield_person</span>
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold tracking-tight text-white">DAT Lab</p>
                        <p className="truncate text-[10px] font-medium uppercase tracking-wider text-gray-500">
                            Management
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    {navItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors
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
                                <span className="flex-1 text-[13px] font-medium">{item.label}</span>
                                {item.badge ? (
                                    <span className="flex min-w-[20px] items-center justify-center rounded-full bg-red-500/90 px-1.5 text-[10px] font-bold text-white">
                                        {item.badge}
                                    </span>
                                ) : null}
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="flex flex-col gap-1 border-t border-[#283039] p-3">
                {bottomNavItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`
                            flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors
                            ${isActive(item.href)
                                ? 'bg-[#137fec]/12 text-white ring-1 ring-[#137fec]/20'
                                : 'text-gray-400 hover:bg-[#1f2937] hover:text-gray-200'
                            }
                        `}
                    >
                        <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                        <span className="text-[13px] font-medium">{item.label}</span>
                    </Link>
                ))}
                <button
                    type="button"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-gray-500 transition-colors hover:bg-[#1f2937] hover:text-gray-300"
                    aria-label="Log out"
                >
                    <span className="material-symbols-outlined text-[22px]">logout</span>
                    <span className="text-[13px] font-medium">Log out</span>
                </button>
            </div>
        </nav>
    );
}
