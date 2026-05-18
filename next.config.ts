import type { NextConfig } from "next";

const allowedDevOrigins = [
  "gx10-3e1c.local",
  ...(process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const nextConfig: NextConfig = {
  output: "standalone",
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  allowedDevOrigins,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
