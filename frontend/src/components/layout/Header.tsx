'use client';

import { useTrackingStore } from '@/stores/trackingStore';

export default function Header() {
    const isOnline = useTrackingStore((state) => state.isOnline);

    return (
        <header className="flex items-center justify-between border-b border-[#283039] bg-[#111418] px-6 py-3 shrink-0 z-50">
            <div className="flex items-center gap-4 text-white">
                {/* Logo */}
                <div className="size-8 flex items-center justify-center bg-[#137fec]/20 text-[#137fec] rounded-lg">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    </svg>
                </div>
                <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
                    EdgeSentinelAI
                </h2>

                {/* Divider */}
                <div className="h-4 w-px bg-[#283039] mx-2"></div>

                {/* System Status */}
                <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span>{isOnline ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}</span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Notifications */}
                <button className="flex items-center justify-center rounded-lg size-10 hover:bg-[#283039] text-white transition-colors relative">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
                    </svg>
                    <span className="absolute top-2 right-2 size-2 bg-[#137fec] rounded-full border-2 border-[#111418]"></span>
                </button>

                {/* User Avatar */}
                <div
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border-2 border-[#283039]"
                    style={{
                        backgroundImage: `url("https://ui-avatars.com/api/?name=Admin&background=137fec&color=fff")`
                    }}
                ></div>
            </div>
        </header>
    );
}
