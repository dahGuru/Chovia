import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@chovia/web-ui", "@chovia/types", "@chovia/validation"],
};

export default nextConfig;
