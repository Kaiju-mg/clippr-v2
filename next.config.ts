import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

// Expone los bindings de Cloudflare a `next dev`. No cambia nada si no se usan.
initOpenNextCloudflareForDev();
