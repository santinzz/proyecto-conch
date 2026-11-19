import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" truena fuera de Next; en pruebas lo reemplazamos por un módulo vacío.
      "server-only": path.resolve(import.meta.dirname, "test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    pool: "threads", // Bun no soporta el pool "forks" de Vitest
    include: ["src/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    env: { TZ: "UTC" }, // como en Vercel: las fechas no deben depender de la zona de la máquina
  },
});
