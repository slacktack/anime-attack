import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anime Attack",
    short_name: "Anime Attack",
    description: "Ad-free anime streaming and manga reading.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e0e10",
    theme_color: "#8b5cf6",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
