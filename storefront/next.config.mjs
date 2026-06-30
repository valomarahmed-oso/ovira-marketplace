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
};

export default nextConfig;
