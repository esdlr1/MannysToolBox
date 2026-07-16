/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fix for chunk loading issues
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }
    // Fix for Windows file system issues
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
      ignored: ['**/node_modules', '**/.git', '**/.next'],
    }
    // Ensure path aliases work in dynamic imports
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname),
    }
    return config
  },
  // Increase timeout for chunk loading
  experimental: {
    optimizePackageImports: ['@prisma/client'],
    // pdfjs-dist must load from node_modules at runtime: bundling it breaks
    // its Node "fake worker" (Cannot find module './pdf.worker.js').
    serverComponentsExternalPackages: ['pdfjs-dist', 'pdf-parse', 'pdfkit'],
  },
}

module.exports = nextConfig
