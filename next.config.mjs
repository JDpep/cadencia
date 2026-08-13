/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next genera AGENTS.md/CLAUDE.md por su cuenta; el proyecto se documenta
  // en README.md, así que no se generan.
  agentRules: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
