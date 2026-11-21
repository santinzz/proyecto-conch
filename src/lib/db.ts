import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

// Conexión de la app a Postgres (Neon en producción).
// - La app usa DATABASE_URL, la conexión CON pooling de Neon (host "-pooler").
// - Las migraciones usan DATABASE_URL_UNPOOLED (ver prisma.config.ts).
// - En Vercel (Fluid compute) attachDatabasePool mantiene viva la función el
//   tiempo justo para cerrar conexiones ociosas, recomendación de Neon y Vercel.

// Una sola instancia por proceso (evita agotar conexiones en dev con recargas).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL en el entorno");
  const pool = new Pool({ connectionString });
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
