import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const workspaceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ["@jinka-eg/ui", "@jinka-eg/types", "@jinka-eg/fixtures", "@jinka-eg/config"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.example.com" },
      { protocol: "https", hostname: "www.jinka.fr" }
    ]
  }
};

export default withNextIntl(nextConfig);
