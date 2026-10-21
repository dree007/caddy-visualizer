import type { NextConfig } from "next";

// Baseline headers for an admin UI. A nonce-based Content-Security-Policy follows
// together with authentication (it requires dynamic rendering of all pages).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'",
  },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for running without the full node_modules tree.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
