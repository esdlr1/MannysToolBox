/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't bundle pdfkit so it can load its font files (Helvetica.afm, etc.) from node_modules
  serverExternalPackages: ['pdfkit'],
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
  },
}

module.exports = nextConfig
