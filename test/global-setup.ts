// Levanta un Postgres en memoria (PGlite) solo para las pruebas de integración y
// le aplica las migraciones de prisma/migrations. No toca la base local ni Neon.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import type { TestProject } from "vitest/node";

export const TEST_DB_PORT = 5434;

export default async function setup(project: TestProject) {
  const db = await PGlite.create();
  const migrationsDir = path.resolve(__dirname, "../prisma/migrations");
  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const name of migrations) {
    await db.exec(readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8"));
  }

  const server = new PGLiteSocketServer({ db, port: TEST_DB_PORT, maxConnections: 10 });
  await server.start();
  project.provide(
    "testDatabaseUrl",
    `postgresql://postgres:postgres@127.0.0.1:${TEST_DB_PORT}/postgres?sslmode=disable`,
  );

  return async () => {
    await server.stop();
    await db.close();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}
