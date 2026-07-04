/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.mux.com',
      },
    ],
  },
  // Remove standalone output for Vercel - not needed and can cause issues
  // output: 'standalone', 
}

module.exports = nextConfig
