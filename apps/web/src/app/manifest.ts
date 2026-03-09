import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jinka EG",
    short_name: "Jinka EG",
    description: "Egypt-first property search and alerts",
    start_url: "/en",
    display: "standalone",
    background_color: "#f8f5ef",
    theme_color: "#8f4f32",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
