import type { NextConfig } from "next";

// cacheComponents/partialPrefetching quedan desactivados a propósito: casi todas
// las pantallas dependen de la sesión y del saldo, que deben leerse en cada
// petición. Ver CLAUDE.md.
const nextConfig: NextConfig = {
  // Solo en `next dev`: deja abrir la app desde otro dispositivo de la red local
  // (p. ej. el celular escaneando un ticket con su cámara). No afecta producción.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // Tesseract.js (OCR de recibos) carga su worker y su WebAssembly desde node_modules
  // en tiempo de ejecución: no se empaqueta, y se incluyen sus archivos en la función.
  serverExternalPackages: ["tesseract.js"],
  outputFileTracingIncludes: {
    "/api/bills": ["./node_modules/tesseract.js/**/*", "./node_modules/tesseract.js-core/**/*"],
  },
  // El service worker nunca se guarda en caché y solo ejecuta código de este sitio
  // (guía de PWA de Next.js).
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
