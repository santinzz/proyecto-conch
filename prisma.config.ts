// Ejecuta Prisma con `bun --bun run prisma <comando>` para que Bun cargue .env.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` (en `bun install` y en el build) no necesita la base de
    // datos, así que no se exige aquí. Los comandos que sí la usan fallan con un
    // error claro si falta DATABASE_URL.
    url: process.env.DATABASE_URL ?? "",
  },
});
