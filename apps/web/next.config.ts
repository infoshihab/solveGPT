import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@solvegpt/model-catalog"],
};

export default nextConfig;
