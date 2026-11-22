// Ejecuta Prisma con `bun --bun run prisma <comando>` para que Bun cargue .env.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun prisma/seed.ts",
  },
  datasource: {
    // Migraciones y seed por la conexión DIRECTA de Neon (sin pooling): el pooler
    // de Neon (PgBouncer en modo transacción) rompe Prisma Migrate. Si no existe
    // (p. ej. PGlite local), se usa DATABASE_URL.
    // `prisma generate` no necesita base de datos, así que aquí no se exige.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
    // Solo en local con PGlite (bun run db:local): base vacía para `prisma migrate dev`.
    // Con Neon no hace falta: Prisma crea y borra su propia base sombra.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
