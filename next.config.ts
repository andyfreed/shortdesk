import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile in the home directory isn't
  // mistakenly picked up as the project root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
