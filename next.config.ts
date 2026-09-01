import type { NextConfig } from 'next';

const API_ORIGIN = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:7831/v1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'komtru-assets.s3.amazonaws.com' },
      { protocol: 'https', hostname: 'cdn.komtru.com' },
      { protocol: 'https', hostname: 'avatars.komtru.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
