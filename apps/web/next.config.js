/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ai-run-sos/contracts', '@ai-run-sos/db'],
  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;
