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
  async rewrites() {
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://127.0.0.1:8787';
    return [
      {
        source: '/api/:path*',
        destination: `${workerUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
