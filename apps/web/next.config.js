/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ai-run-sos/contracts', '@ai-run-sos/db'],
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
