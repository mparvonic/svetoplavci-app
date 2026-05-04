import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
