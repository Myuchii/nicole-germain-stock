import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['prisma', '@prisma/client']
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig
