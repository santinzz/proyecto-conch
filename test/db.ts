// Cliente Prisma para pruebas de integración (PGlite en memoria de global-setup.ts).
import { PrismaPg } from "@prisma/adapter-pg";
import { inject } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { SPEC_RULES } from "./fixtures";

export function createTestDb() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: inject("testDatabaseUrl") }) });
}

/** Deja la base vacía con las reglas iniciales de SPEC.md. */
export async function resetDb(db: PrismaClient) {
  await db.$executeRawUnsafe(
    `TRUNCATE "PointEntry", "Sale", "Product", "Redemption", "RecycleClaim", "Bill", "ServiceAccount", "User", "Rule" CASCADE`,
  );
  await db.rule.createMany({ data: Object.entries(SPEC_RULES).map(([key, r]) => ({ key, ...r })) });
}
