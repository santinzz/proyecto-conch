// Pruebas de integración del libro de puntos contra un Postgres real (PGlite en
// memoria, levantado en test/global-setup.ts con las migraciones del proyecto).
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, inject, test } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { SPEC_RULES } from "../../../test/fixtures";
import {
  balanceOf,
  creditBillReduction,
  creditBringContainer,
  creditPurchase,
  creditRecycle,
  debitPoints,
  earnedInLevelWindow,
  PointsError,
} from "./ledger";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: inject("testDatabaseUrl") }) });
afterAll(() => db.$disconnect());

let userId: string;
const NOW = new Date("2026-11-19T18:00:00Z"); // jueves 12:00 en CDMX

beforeEach(async () => {
  await db.$executeRawUnsafe(`TRUNCATE "PointEntry", "User", "Rule" CASCADE`);
  await db.rule.createMany({
    data: Object.entries(SPEC_RULES).map(([key, r]) => ({ key, ...r })),
  });
  const user = await db.user.create({
    data: { name: "Ana", email: "ana@ecopuntos.test", passwordHash: "x" },
  });
  userId = user.id;
});

/** Suma directa en SQL, para comparar con balanceOf. */
async function sqlSum(id: string) {
  const [row] = await db.$queryRaw<{ sum: bigint | null }[]>`
    SELECT SUM(points) AS sum FROM "PointEntry" WHERE "userId" = ${id}`;
  return Number(row.sum ?? 0);
}

async function seedEarned(points: number, when = NOW) {
  await db.pointEntry.create({ data: { userId, type: "ADJUSTMENT", points, sourceId: `adj-${points}-${when.getTime()}`, createdAt: when } });
}

const items = [
  { qty: 1, priceCents: 4500, ecoScore: "A" as const }, // 12
  { qty: 2, priceCents: 3000, ecoScore: "B" as const }, // 12
];

describe("reglas generales del libro", () => {
  test("se niega a acreditar fuera de una transacción", async () => {
    await expect(creditPurchase(db, { userId, saleId: "s1", items })).rejects.toThrow(/db.\$transaction/);
  });

  test("usuario inexistente", async () => {
    await expect(
      db.$transaction((tx) => creditPurchase(tx, { userId: "no-existe", saleId: "s1", items })),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  test("la misma evidencia no paga dos veces y el segundo intento no cambia el saldo", async () => {
    await db.$transaction((tx) => creditPurchase(tx, { userId, saleId: "s1", items, now: NOW }));
    await expect(
      db.$transaction((tx) => creditPurchase(tx, { userId, saleId: "s1", items, now: NOW })),
    ).rejects.toMatchObject({ code: "ALREADY_CREDITED" });
    expect(await balanceOf(db, userId)).toBe(24);
  });

  test("si la transacción falla, no queda ningún punto", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await creditPurchase(tx, { userId, saleId: "s1", items, now: NOW });
        throw new Error("falló algo después de acreditar");
      }),
    ).rejects.toThrow();
    expect(await db.pointEntry.count()).toBe(0);
  });

  test("el saldo siempre es la suma de PointEntry", async () => {
    await db.$transaction((tx) => creditPurchase(tx, { userId, saleId: "s1", items, now: NOW }));
    await db.$transaction((tx) => creditBringContainer(tx, { userId, saleId: "s1", now: NOW }));
    await db.$transaction((tx) => creditRecycle(tx, { userId, claimId: "r1", pieces: 4, now: NOW }));
    await db.$transaction((tx) => debitPoints(tx, { userId, type: "REDEEM", sourceId: "c1", points: 30, now: NOW }));
    const balance = await balanceOf(db, userId);
    expect(balance).toBe(24 + 10 + 20 - 30);
    expect(balance).toBe(await sqlSum(userId));
  });

  test("los valores salen de la tabla Rule", async () => {
    await db.rule.update({ where: { key: "BRING_CONTAINER" }, data: { points: 15 } });
    const r = await db.$transaction((tx) => creditBringContainer(tx, { userId, saleId: "s1", now: NOW }));
    expect(r.entry.points).toBe(15);
  });
});

describe("compras y niveles", () => {
  test("Semilla: sin bono", async () => {
    const r = await db.$transaction((tx) => creditPurchase(tx, { userId, saleId: "s1", items, now: NOW }));
    expect(r).toMatchObject({ base: 24, bonus: 0, total: 24, level: "Semilla" });
  });

  test("Brote: +10% en compras", async () => {
    await seedEarned(500);
    const r = await db.$transaction((tx) => creditPurchase(tx, { userId, saleId: "s1", items, now: NOW }));
    expect(r).toMatchObject({ total: 26, level: "Brote" });
  });

  test("Árbol: +20% en compras", async () => {
    await seedEarned(2000);
    const r = await db.$transaction((tx) => creditPurchase(tx, { userId, saleId: "s1", items, now: NOW }));
    expect(r).toMatchObject({ total: 28, level: "Árbol" });
  });

  test("el nivel no cuenta canjes, donaciones ni puntos de hace más de 180 días", async () => {
    await seedEarned(600, new Date("2026-04-01T00:00:00Z")); // fuera de la ventana
    await seedEarned(300);
    await db.$transaction((tx) => debitPoints(tx, { userId, type: "REDEEM", sourceId: "c1", points: 100, now: NOW }));
    await db.$transaction((tx) => debitPoints(tx, { userId, type: "DONATION", sourceId: "d1", points: 100, now: NOW }));
    expect(await earnedInLevelWindow(db, userId, NOW)).toBe(300);
    const r = await db.$transaction((tx) => creditPurchase(tx, { userId, saleId: "s1", items, now: NOW }));
    expect(r.level).toBe("Semilla");
  });
});

describe("trajo su envase (1 por día)", () => {
  test("el primero del día paga 10", async () => {
    const r = await db.$transaction((tx) => creditBringContainer(tx, { userId, saleId: "s1", now: NOW }));
    expect(r).toMatchObject({ limitReached: false });
    expect(r.entry.points).toBe(10);
  });

  test("límite diario alcanzado: el segundo no paga, pero sí cuenta como envase", async () => {
    await db.$transaction((tx) => creditBringContainer(tx, { userId, saleId: "s1", now: NOW }));
    const r = await db.$transaction((tx) => creditBringContainer(tx, { userId, saleId: "s2", now: NOW }));
    expect(r).toMatchObject({ limitReached: true });
    expect(r.entry.points).toBe(0);
    expect(r.entry.impact).toEqual({ containers: 1 });
    expect(await db.pointEntry.count({ where: { type: "BRING_CONTAINER" } })).toBe(2);
    expect(await balanceOf(db, userId)).toBe(10);
  });

  test("al día siguiente (hora de CDMX) vuelve a pagar", async () => {
    await db.$transaction((tx) =>
      creditBringContainer(tx, { userId, saleId: "s1", now: new Date("2026-11-20T05:00:00Z") }), // 19 nov 23:00
    );
    const r = await db.$transaction((tx) =>
      creditBringContainer(tx, { userId, saleId: "s2", now: new Date("2026-11-20T06:30:00Z") }), // 20 nov 00:30
    );
    expect(r.entry.points).toBe(10);
  });

  test("peticiones simultáneas no se brincan el límite", async () => {
    await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        db.$transaction((tx) => creditBringContainer(tx, { userId, saleId: `s${i}`, now: NOW })),
      ),
    );
    expect(await balanceOf(db, userId)).toBe(10);
    expect(await db.pointEntry.count({ where: { type: "BRING_CONTAINER" } })).toBe(5);
  });
});

describe("reciclaje (20 piezas por semana)", () => {
  test("paga 5 por pieza", async () => {
    const r = await db.$transaction((tx) => creditRecycle(tx, { userId, claimId: "r1", pieces: 15, now: NOW }));
    expect(r.entry.points).toBe(75);
  });

  test("límite semanal parcial: paga solo las que caben y registra todas", async () => {
    await db.$transaction((tx) => creditRecycle(tx, { userId, claimId: "r1", pieces: 15, now: NOW }));
    const r = await db.$transaction((tx) => creditRecycle(tx, { userId, claimId: "r2", pieces: 10, now: NOW }));
    expect(r.paidPieces).toBe(5);
    expect(r.entry.points).toBe(25);
    expect(r.entry.impact).toEqual({ pieces: 10, paidPieces: 5 });
  });

  test("con el límite lleno no paga; la semana siguiente sí", async () => {
    await db.$transaction((tx) => creditRecycle(tx, { userId, claimId: "r1", pieces: 20, now: NOW }));
    const full = await db.$transaction((tx) => creditRecycle(tx, { userId, claimId: "r2", pieces: 3, now: NOW }));
    expect(full.entry.points).toBe(0);
    const nextWeek = new Date("2026-11-23T07:00:00Z"); // lunes 23 nov 01:00 CDMX
    const r = await db.$transaction((tx) => creditRecycle(tx, { userId, claimId: "r3", pieces: 3, now: nextWeek }));
    expect(r.entry.points).toBe(15);
  });

  test("rechaza piezas no válidas", async () => {
    await expect(
      db.$transaction((tx) => creditRecycle(tx, { userId, claimId: "r1", pieces: 0, now: NOW })),
    ).rejects.toThrow();
  });
});

describe("reducción en recibo", () => {
  const period = (start: string, end: string, consumption: number) => ({
    periodStart: new Date(`${start}T00:00:00Z`),
    periodEnd: new Date(`${end}T00:00:00Z`),
    consumption,
  });
  const prev = period("2026-07-01", "2026-08-30", 600); // 60 días, 10 kWh/día
  const curr = period("2026-08-30", "2026-10-29", 480); // 60 días, 8 kWh/día → 20%

  test("primer recibo: línea base con 0 puntos, pero queda registrado", async () => {
    const r = await db.$transaction((tx) =>
      creditBillReduction(tx, { userId, billId: "b1", kind: "ELECTRICITY", prev: null, curr: prev, feSen: 0.444, now: NOW }),
    );
    expect(r).toMatchObject({ baseline: true, points: 0 });
    expect(await db.pointEntry.count({ where: { type: "BILL_REDUCTION" } })).toBe(1);
  });

  test("segundo recibo con 20% menos: 200 puntos, kWh y CO₂", async () => {
    const r = await db.$transaction((tx) =>
      creditBillReduction(tx, { userId, billId: "b2", kind: "ELECTRICITY", prev, curr, feSen: 0.444, now: NOW }),
    );
    expect(r.points).toBe(200);
    expect(r.entry.impact).toEqual({ kwh: 120, co2Kg: 53.28 });
  });

  test("50% de reducción queda en el tope de 200", async () => {
    const r = await db.$transaction((tx) =>
      creditBillReduction(tx, {
        userId, billId: "b2", kind: "ELECTRICITY", prev, curr: period("2026-08-30", "2026-10-29", 300), feSen: 0.444, now: NOW,
      }),
    );
    expect(r.points).toBe(200);
  });

  test("recibo de agua guarda m³", async () => {
    const r = await db.$transaction((tx) =>
      creditBillReduction(tx, {
        userId, billId: "w2", kind: "WATER",
        prev: period("2026-07-01", "2026-08-30", 30), curr: period("2026-08-30", "2026-10-29", 27), feSen: 0.444, now: NOW,
      }),
    );
    expect(r.points).toBe(100);
    expect(r.entry.impact).toEqual({ m3: 3 });
  });
});

describe("canjes y donaciones", () => {
  test("sin saldo suficiente se rechaza y no crea nada", async () => {
    await seedEarned(50);
    const attempt = db.$transaction((tx) =>
      debitPoints(tx, { userId, type: "REDEEM", sourceId: "c1", points: 100, now: NOW }),
    );
    await expect(attempt).rejects.toBeInstanceOf(PointsError);
    await expect(attempt).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
    expect(await balanceOf(db, userId)).toBe(50);
  });

  test("con saldo justo queda en 0, nunca negativo", async () => {
    await seedEarned(100);
    const r = await db.$transaction((tx) =>
      debitPoints(tx, { userId, type: "DONATION", sourceId: "d1", points: 100, now: NOW }),
    );
    expect(r.entry.points).toBe(-100);
    expect(r.balance).toBe(0);
    expect(await balanceOf(db, userId)).toBe(0);
  });

  test("dos canjes simultáneos no dejan saldo negativo", async () => {
    await seedEarned(100);
    const results = await Promise.allSettled(
      ["c1", "c2"].map((sourceId) =>
        db.$transaction((tx) => debitPoints(tx, { userId, type: "REDEEM", sourceId, points: 100, now: NOW })),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await balanceOf(db, userId)).toBe(0);
  });

  test("rechaza cantidades no válidas", async () => {
    await expect(
      db.$transaction((tx) => debitPoints(tx, { userId, type: "REDEEM", sourceId: "c1", points: -5, now: NOW })),
    ).rejects.toThrow();
  });
});
