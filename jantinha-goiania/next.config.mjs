/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16: módulos nativos Node.js (MySQL) fora do bundle
  serverExternalPackages: ['mysql2'],

  // Headers de segurança mobile
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY'    },
        ],
      },
    ];
  },
};

export default nextConfig;
