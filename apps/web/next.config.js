/** @type {import('next').NextConfig} */

// The browser loads this app directly, so it needs its own security headers in
// addition to the ones the API sets on its JSON responses.
//
// The policy is built from the origins this app actually uses rather than a
// generic template:
//   - OpenStreetMap raster tiles for the live map (Leaflet).
//   - The REST API and its server-sent-event stream, via NEXT_PUBLIC_API_URL.
// Leaflet's marker images are bundled locally by npm, so they stay 'self'.
const isProduction = process.env.NODE_ENV === 'production';

const apiOrigin = (() => {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
  try {
    return new URL(raw).origin;
  } catch {
    // A malformed URL must not break the build; fall back to same-origin only.
    return "'self'";
  }
})();

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js 14 inlines the RSC flight payload in a <script> tag and Leaflet
  // positions tiles/panes with inline style attributes, both of which need
  // 'unsafe-inline'. A per-request nonce would remove it, but only at the cost
  // of forcing every route out of static prerendering - a worse trade here.
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  // Never let a browser second-guess a declared content type.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No clickjacking: the booking flow performs real actions.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Bookings carry personal and location data; keep paths off third parties.
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // The booking form asks for geolocation and nothing else.
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(self), camera=(), microphone=()',
  },
];

if (isProduction) {
  // TLS is terminated in front of the service (Render, Vercel).
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  });
}

const nextConfig = {
  reactStrictMode: true,

  // Emits a self-contained server bundle in .next/standalone with only the
  // node_modules actually imported. This is what the production Docker image
  // runs; Vercel ignores this setting and keeps using its own build output.
  output: 'standalone',

  // Keep image handling conservative: the app relies on vector maps and SVG,
  // and there is no image CDN to lean on.
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
