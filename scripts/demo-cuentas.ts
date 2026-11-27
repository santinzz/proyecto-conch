// Carga SOLO las cuentas ficticias con historial (Enrique y Emilio) en la base
// a la que apunte DATABASE_URL_UNPOOLED (o DATABASE_URL). No toca a los otros
// usuarios demo ni sus contraseñas, así que se puede correr contra producción:
//
//   $env:DATABASE_URL_UNPOOLED = "<URL directa de Neon>"
//   $env:DEMO_ACCOUNTS_PASSWORD = "<contraseña para las dos cuentas>"
//   bun run demo:cuentas
//
// Es idempotente. Estas cuentas (@ecopuntos.test) no cuentan en las métricas del piloto.
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedDemoHistories } from "../prisma/seed-demo-history";

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Falta DATABASE_URL_UNPOOLED o DATABASE_URL");
const password = process.env.DEMO_ACCOUNTS_PASSWORD;
if (!password || password.length < 8) throw new Error("Define DEMO_ACCOUNTS_PASSWORD (mínimo 8 caracteres)");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const host = new URL(connectionString).host;
console.log(`Cargando cuentas demo en ${host}…`);

seedDemoHistories(db, {
  passwordHash: await bcrypt.hash(password, 10),
  feSen: Number(process.env.FE_SEN ?? "0.444"),
  now: new Date(),
})
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
