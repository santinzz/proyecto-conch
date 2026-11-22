import type { MetadataRoute } from "next";

// Manifest de la PWA: con esto (y HTTPS) Android y iPhone ofrecen instalar la app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EcoPuntos",
    short_name: "EcoPuntos",
    description: "Gana puntos por consumir y actuar de forma sustentable.",
    lang: "es-MX",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#2f855a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Escanear QR", url: "/escanear", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Mis recibos", url: "/recibos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
