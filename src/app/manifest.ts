import type { MetadataRoute } from "next";

// Web app manifest — makes the OS installable from the browser (iPhone
// Share → Add to Home Screen, Android/desktop install prompts). Served at
// /manifest.webmanifest; that path is excluded from the auth middleware so
// browsers can fetch it without a session.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TexasTurf OS",
    short_name: "TexasTurf",
    description: "TexasTurf operations and command center",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#faf9f6",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Long-press the home-screen icon (Android; iOS ignores shortcuts).
    shortcuts: [
      { name: "Dashboard", url: "/dashboard" },
      { name: "Tasks", url: "/tasks" },
      { name: "Fleet", url: "/fleet" },
      { name: "Turfy", url: "/assistant" },
    ],
  };
}
