import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kartly",
    short_name: "Kartly",
    description: "A transparent online store. Plain prices, no sponsored results.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F4EF",
    theme_color: "#0E3F3D",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
