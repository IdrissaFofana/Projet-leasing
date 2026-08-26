import type { NextConfig } from 'next';

/**
 * Next.js 16 bloque les assets de dev (_next/…) depuis une autre origine.
 * Sans ça, ouvrir http://IP:3000 depuis un autre PC = favicon OK, page blanche.
 * Ajoutez votre IP LAN (ou un hostname) si elle change.
 */
const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.1.52',
    '192.168.*.*',
    '10.*.*.*',
    '172.*.*.*',
  ],
};

export default nextConfig;
