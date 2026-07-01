/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Served under a path on the Frappe site, e.g. ovira.cloud/shop. Same-origin
  // API calls use the absolute NEXT_PUBLIC_FRAPPE_URL so they are unaffected.
  basePath: "/shop",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async redirects() {
    return [
      // Safety net: an older build/PWA cache pointed at this route. Never 404.
      { source: "/landing-page", destination: "/", permanent: false },
    ];
  },
  // Baseline security headers for the storefront. Deliberately conservative —
  // no resource-restricting CSP (which would need nonces and could break the
  // app); only clickjacking, sniffing, referrer, transport and permissions.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};

export default nextConfig;
