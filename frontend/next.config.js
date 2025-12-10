/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from Google and YouTube
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'places.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
  env: {
    // Empty string means use relative path (proxied by Next.js)
    NEXT_PUBLIC_WORKER_URL: '',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8787/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
