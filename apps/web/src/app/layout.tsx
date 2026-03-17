import type { Metadata } from "next";

import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";

export const metadata: Metadata = {
  title: "Jinka EG",
  description: "Egypt-first real estate aggregator for alerts, deduplication, and trust-aware discovery."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
