import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anime Attack",
    short_name: "Anime Attack",
    description: "Ad-free anime streaming and manga reading.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e0e10",
    theme_color: "#ff3d5f",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
