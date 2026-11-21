// Datos iniciales del piloto. Es idempotente: se puede correr varias veces.
//   bun --bun run prisma db seed
//
// Las contraseñas de los usuarios demo salen de SEED_DEMO_PASSWORD (.env).
// Nunca dejes una contraseña demo conocida en la base de datos de producción.
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "../src/generated/prisma/client";

// Conexión directa (sin pooling) si existe, igual que las migraciones.
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Falta DATABASE_URL");
const demoPassword = process.env.SEED_DEMO_PASSWORD;
if (!demoPassword || demoPassword.length < 8) {
  throw new Error("Define SEED_DEMO_PASSWORD (mínimo 8 caracteres) en .env");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DAY = 24 * 60 * 60 * 1000;

// Valores iniciales de SPEC.md ("Reglas de negocio").
// El significado de limitCount depende de la regla (lo interpreta src/lib/points/):
//   BRING_CONTAINER: veces por periodo · RECYCLE: piezas por periodo ·
//   BILL_REDUCTION: puntos máximos por recibo.
const rules = [
  { key: "PURCHASE_A", points: 3, limitCount: null, limitPeriod: null }, // por cada $10
  { key: "PURCHASE_B", points: 2, limitCount: null, limitPeriod: null },
  { key: "PURCHASE_C", points: 1, limitCount: null, limitPeriod: null },
  { key: "BRING_CONTAINER", points: 10, limitCount: 1, limitPeriod: "day" },
  { key: "RECYCLE", points: 5, limitCount: 20, limitPeriod: "week" }, // por pieza
  { key: "BILL_REDUCTION", points: 50, limitCount: 200, limitPeriod: "bill" }, // por cada 5%
  { key: "CHALLENGE", points: 100, limitCount: null, limitPeriod: null }, // valor por defecto
];

const products = [
  { id: "prod-jabon-granel", name: "Jabón líquido a granel (500 ml)", priceCents: 4500, bulk: true, local: true, plasticFree: true, certified: false },
  { id: "prod-cepillo-bambu", name: "Cepillo de dientes de bambú", priceCents: 3500, bulk: false, local: false, plasticFree: true, certified: true },
  { id: "prod-bolsa-tela", name: "Bolsa de tela reutilizable", priceCents: 6000, bulk: false, local: true, plasticFree: true, certified: false },
  { id: "prod-miel-local", name: "Miel local (frasco retornable)", priceCents: 8000, bulk: true, local: true, plasticFree: false, certified: false },
  { id: "prod-popote-acero", name: "Popote de acero inoxidable", priceCents: 2500, bulk: false, local: false, plasticFree: true, certified: false },
  { id: "prod-galletas", name: "Galletas artesanales", priceCents: 3000, bulk: false, local: false, plasticFree: false, certified: false },
];

const rewards = [
  { id: "rew-cupon-10", name: "Cupón de $10 en el stand", cost: 100, stock: 200, isDonation: false },
  { id: "rew-bolsa-tela", name: "Bolsa de tela EcoPuntos", cost: 500, stock: 20, isDonation: false },
  { id: "rew-arbol", name: "Donar un árbol plantado", cost: 300, stock: 1000, isDonation: true },
];

async function main() {
  const now = new Date();

  for (const r of rules) {
    await db.rule.upsert({ where: { key: r.key }, update: {}, create: r });
  }

  for (const p of products) {
    await db.product.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  await db.recycleBin.upsert({
    where: { code: "CAMPUS-01" },
    update: {},
    create: { name: "Contenedor principal", location: "Patio central del campus", code: "CAMPUS-01" },
  });

  const challenges = [
    { id: "reto-envase-5", title: "Trae tu envase 5 veces", metric: "BRING_CONTAINER_count", target: 5, reward: 100 },
    { id: "reto-luz-10", title: "Reduce 10% tu consumo de luz", metric: "ELECTRICITY_reduction_pct", target: 10, reward: 150 },
    { id: "reto-reciclaje-30", title: "Recicla 30 piezas", metric: "RECYCLE_pieces", target: 30, reward: 100 },
  ];
  for (const c of challenges) {
    await db.challenge.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, startsAt: now, endsAt: new Date(now.getTime() + 21 * DAY) },
    });
  }

  for (const r of rewards) {
    await db.reward.upsert({ where: { id: r.id }, update: {}, create: r });
  }

  const passwordHash = await bcrypt.hash(demoPassword!, 10);
  const users = [
    { email: "cliente@ecopuntos.test", name: "Cliente Demo", role: Role.CUSTOMER },
    { email: "operador@ecopuntos.test", name: "Operador Demo", role: Role.OPERATOR },
    { email: "admin@ecopuntos.test", name: "Admin Demo", role: Role.ADMIN },
  ];
  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role },
      create: { ...u, passwordHash },
    });
  }

  console.log(
    `Seed listo: ${rules.length} reglas, ${products.length} productos, 1 contenedor, ` +
      `${challenges.length} retos, ${rewards.length} recompensas, ${users.length} usuarios demo.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
