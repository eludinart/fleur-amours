import type { NextConfig } from 'next'
import path from 'path'

// Node API : MariaDB direct via les routes Next.js
const useNodeApi = process.env.USE_NODE_API !== 'false'
const apiTarget = process.env.NEXT_PUBLIC_API_TARGET || 'http://127.0.0.1:0'
const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1'

const nextConfig: NextConfig = {
  basePath: '/jardin',
  assetPrefix: '/jardin/',
  output: isCapacitorBuild ? 'export' : 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['recharts', 'react-force-graph-2d', 'd3-array', 'd3-scale', 'd3-shape', 'd3-force-3d'],
  outputFileTracingRoot: path.resolve(process.cwd()),
  reactStrictMode: true,
  async redirects() {
    return [
      // Évite le double /jardin/jardin (page blanche)
      { source: '/jardin', destination: '/', permanent: false },
      { source: '/', destination: '/jardin', permanent: false, basePath: false },
    ]
  },
  async rewrites() {
    // Capacitor: export statique, API externe via NEXT_PUBLIC_API_URL
    if (isCapacitorBuild) return []
    // USE_NODE_API=true : tout servi par Next.js + MariaDB
    if (useNodeApi) return []
    // Proxy externe (si USE_NODE_API=false)
    return [
      { source: '/api/:path*', destination: `${apiTarget}/api/:path*` },
      { source: '/cartes/:path*', destination: `${apiTarget}/cartes/:path*` },
    ]
  },
}

export default nextConfig
