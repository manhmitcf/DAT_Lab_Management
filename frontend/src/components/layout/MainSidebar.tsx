'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebarStore } from '@/stores/sidebarStore';

const navItems = [
    { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { href: '/', icon: 'videocam', label: 'Live Feeds' },
    { href: '/analytics', icon: 'analytics', label: 'Analytics' },
    { href: '/alerts', icon: 'notifications', label: 'Alerts', badge: 3 },
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
        <div className={`${isCollapsed ? 'w-20' : 'w-64'} flex flex-col justify-between bg-[#1B2431] border-r border-[#2a3441] flex-shrink-0 transition-all duration-300 ease-in-out`}>
            <div className="flex flex-col gap-4 p-4">
                {/* Toggle Button */}
                <button
                    onClick={toggleSidebar}
                    className="flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors self-end"
                    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <span className="material-symbols-outlined text-xl">
                        {isCollapsed ? 'chevron_right' : 'chevron_left'}
                    </span>
                </button>

                {/* User Profile / Brand */}
                <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''} mb-4`}>
                    <div
                        className="bg-center bg-no-repeat bg-cover rounded-full size-10 shrink-0 border-2 border-[#137fec]"
                        style={{ backgroundImage: `url("https://ui-avatars.com/api/?name=Admin&background=137fec&color=fff")` }}
                    />
                    {!isCollapsed && (
                        <div className="flex-col flex overflow-hidden">
                            <h1 className="text-white text-base font-medium leading-normal truncate">Admin User</h1>
                            <p className="text-slate-400 text-xs font-normal leading-normal truncate">System Administrator</p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex flex-col gap-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-3 rounded-lg group transition-colors ${isCollapsed ? 'justify-center' : ''} ${isActive(item.href)
                                ? 'bg-[#137fec] text-white'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            {!isCollapsed && (
                                <>
                                    <p className="text-sm font-medium flex-1">{item.label}</p>
                                    {item.badge && (
                                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                            {item.badge}
                                        </span>
                                    )}
                                </>
                            )}
                            {isCollapsed && item.badge && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] size-4 flex items-center justify-center rounded-full">
                                    {item.badge}
                                </span>
                            )}
                        </Link>
                    ))}
                </nav>
            </div>

            {/* Bottom Nav */}
            <div className="p-4 flex flex-col gap-2 border-t border-[#2a3441]">
                {bottomNavItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg group transition-colors ${isCollapsed ? 'justify-center' : ''} ${isActive(item.href)
                            ? 'bg-[#137fec] text-white'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                        title={isCollapsed ? item.label : undefined}
                    >
                        <span className="material-symbols-outlined">{item.icon}</span>
                        {!isCollapsed && <p className="text-sm font-medium">{item.label}</p>}
                    </Link>
                ))}
                <button
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors group ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? 'Logout' : undefined}
                >
                    <span className="material-symbols-outlined">logout</span>
                    {!isCollapsed && <p className="text-sm font-medium">Logout</p>}
                </button>
            </div>
        </div>
    );
}
