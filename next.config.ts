import type { NextConfig } from "next";

// cacheComponents/partialPrefetching quedan desactivados a propósito: casi todas
// las pantallas dependen de la sesión y del saldo, que deben leerse en cada
// petición. Ver CLAUDE.md.
const nextConfig: NextConfig = {
  // Solo en `next dev`: deja abrir la app desde otro dispositivo de la red local
  // (p. ej. el celular escaneando un ticket con su cámara). No afecta producción.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
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
