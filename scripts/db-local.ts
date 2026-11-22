// Postgres local para desarrollo con PGlite (no hace falta instalar Postgres).
//   bun run db:local      (déjalo abierto)
//
// - 127.0.0.1:5433 · base de desarrollo, guardada en ./.pglite (DATABASE_URL)
// - 127.0.0.1:5435 · base "sombra" vacía y en memoria, solo para `prisma migrate dev`
//   (SHADOW_DATABASE_URL). PGlite ignora el nombre de la base en la conexión, así que
//   sin ella Prisma creaba su base sombra encima de la real y fallaba con P3005.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const MAIN_PORT = 5433;
const SHADOW_PORT = 5435;

async function main() {
  console.log("Iniciando base local…");
  const db = new PGlite("./.pglite");
  const shadow = new PGlite();
  await Promise.all([db.waitReady, shadow.waitReady]);

  const servers = [
    new PGLiteSocketServer({ db, port: MAIN_PORT, maxConnections: 10 }),
    new PGLiteSocketServer({ db: shadow, port: SHADOW_PORT, maxConnections: 10 }),
  ];
  await Promise.all(servers.map((s) => s.start()));
  console.log(
    `Base local lista en 127.0.0.1:${MAIN_PORT} (datos en .pglite) y base sombra en 127.0.0.1:${SHADOW_PORT}. ` +
      "Ctrl+C para cerrar.",
  );

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await Promise.all(servers.map((s) => s.stop()));
    await Promise.all([db.close(), shadow.close()]);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
