import type { NextConfig } from "next";

import { buildContentSecurityPolicy } from "./src/lib/content-security-policy";

const isProductionDeploy =
  process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
const isDevServer = process.env.NODE_ENV === "development";

const contentSecurityPolicy = buildContentSecurityPolicy({
  isProductionDeploy,
  isDevServer,
});

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
  { key: "X-XSS-Protection", value: "0" },
  ...(isProductionDeploy
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Standalone bundle for Docker/K8s; Vercel ignores this output layout.
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
