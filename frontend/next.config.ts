import type { NextConfig } from "next";

const API_PORT = process.env.NEXT_PUBLIC_API_PORT || '8000';
const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  output: 'standalone',
  ...(isDev && {
    async rewrites() {
      return [{ source: '/api/:path*', destination: `http://127.0.0.1:${API_PORT}/api/:path*` }];
    },
  }),
};

export default nextConfig;
