import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Footgolf",
    short_name: "Footgolf",
    description: "Arkádový footgolf priamo v prehliadači — tri jamky, realistická fyzika, žiadne inštalácie.",
    start_url: "/",
    display: "standalone",
    background_color: "#031014",
    theme_color: "#031014",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
