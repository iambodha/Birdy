import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  typescript: {
    ignoreBuildErrors: false
  },
  eslint: {
    ignoreDuringBuilds: false
  },
  exportPathMap: async function (
    defaultPathMap,
    { dev, dir, outDir, distDir, buildId }
  ) {
    // Filter out API routes from the export
    const pathMap = { ...defaultPathMap };
    Object.keys(pathMap).forEach(path => {
      if (path.startsWith('/api/')) {
        delete pathMap[path];
      }
    });
    return pathMap;
  }
};

export default nextConfig;
