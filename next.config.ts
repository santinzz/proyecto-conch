import type { NextConfig } from "next";

// cacheComponents/partialPrefetching quedan desactivados a propósito: casi todas
// las pantallas dependen de la sesión y del saldo, que deben leerse en cada
// petición. Ver CLAUDE.md.
const nextConfig: NextConfig = {
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
