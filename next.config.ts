import type { NextConfig } from "next";
import { buildContentSecurityPolicy } from "./src/lib/csp";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const securityHeaders = [
      { key: "Content-Security-Policy", value: buildContentSecurityPolicy(process.env.NODE_ENV === "development") },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/grupos/:groupId/resultado", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }] },
    ];
  },
};

export default nextConfig;
