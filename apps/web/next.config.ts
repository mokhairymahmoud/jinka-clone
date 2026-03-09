import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@jinka-eg/ui", "@jinka-eg/types", "@jinka-eg/fixtures", "@jinka-eg/config"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.example.com" },
      { protocol: "https", hostname: "www.jinka.fr" }
    ]
  }
};

export default withNextIntl(nextConfig);
