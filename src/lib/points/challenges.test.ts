// Retos: se pagan solos al llegar a la meta, dentro de sus fechas y una sola vez.
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createTestDb, resetDb } from "../../../test/db";
import { isChallengeMetric, progressPct } from "./challenge-metrics";
import { challengesForUser, evaluateChallenges } from "./challenges";
import { balanceOf, creditBringContainer, creditRecycle } from "./ledger";

const db = createTestDb();
afterAll(() => db.$disconnect());

const NOW = new Date("2026-11-20T18:00:00Z"); // viernes
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
let userId: string;

beforeEach(async () => {
  await resetDb(db);
  userId = (await db.user.create({ data: { name: "Ana", email: "ana@t.test", passwordHash: "x" } })).id;
});

const challenge = (data: { metric: string; target: number; startsAt?: Date; endsAt?: Date; reward?: number }) =>
  db.challenge.create({
    data: { title: `Reto ${data.metric}`, reward: 100, startsAt: days(-7), endsAt: days(7), ...data },
  });
const container = (saleId: string, now: Date) =>
  db.$transaction((tx) => creditBringContainer(tx, { userId, saleId, now }));
const evaluate = (now = NOW) => db.$transaction((tx) => evaluateChallenges(tx, { userId, now }));

test("avance en porcentaje", () => {
  expect(progressPct(3, 5)).toBe(60);
  expect(progressPct(9, 5)).toBe(100);
  expect(progressPct(0, 0)).toBe(100);
  expect(isChallengeMetric("RECYCLE_pieces")).toBe(true);
  expect(isChallengeMetric("toString")).toBe(false);
});

describe("evaluar retos", () => {
  test("paga al llegar a la meta y solo una vez", async () => {
    await challenge({ metric: "BRING_CONTAINER_count", target: 3 });
    await container("s1", days(-3));
    await container("s2", days(-2));
    expect(await evaluate(days(-2))).toEqual([]);
    await container("s3", days(-1));
    expect(await evaluate()).toMatchObject([{ title: "Reto BRING_CONTAINER_count", reward: 100 }]);
    expect(await evaluate()).toEqual([]);
    expect(await balanceOf(db, userId)).toBe(3 * 10 + 100);
  });

  test("solo cuenta lo que pasó dentro de las fechas del reto", async () => {
    await challenge({ metric: "BRING_CONTAINER_count", target: 2, startsAt: days(-1) });
    await container("antes", days(-3));
    await container("dentro", NOW);
    expect(await evaluate()).toEqual([]);
  });

  test("un reto que ya terminó o no ha empezado no paga", async () => {
    await challenge({ metric: "BRING_CONTAINER_count", target: 1, startsAt: days(-10), endsAt: days(-1) });
    await challenge({ metric: "BRING_CONTAINER_count", target: 1, startsAt: days(1), endsAt: days(10) });
    await container("s1", NOW);
    expect(await evaluate()).toEqual([]);
  });

  test("piezas recicladas: cuentan todas las aprobadas, aunque el límite semanal no las pague", async () => {
    await challenge({ metric: "RECYCLE_pieces", target: 30 });
    await db.$transaction((tx) => creditRecycle(tx, { userId, claimId: "r1", pieces: 15, now: days(-2) }));
    await db.$transaction((tx) => creditRecycle(tx, { userId, claimId: "r2", pieces: 20, now: days(-1) }));
    expect(await evaluate()).toHaveLength(1);
  });

  test("reducción en el recibo de luz: cuenta un recibo aprobado dentro de las fechas", async () => {
    await challenge({ metric: "ELECTRICITY_reduction_pct", target: 10 });
    const bill = (fileHash: string, reductionPct: number, reviewedAt: Date) =>
      db.bill.create({ data: { userId, kind: "ELECTRICITY", fileHash, status: "APPROVED", reductionPct, reviewedAt } });
    await bill("h1", 8, days(-2));
    expect(await evaluate()).toEqual([]);
    await bill("h2", 12, days(-1));
    expect(await evaluate()).toHaveLength(1);
  });

  test("una métrica desconocida nunca se completa", async () => {
    await challenge({ metric: "NO_EXISTE", target: 1 });
    await container("s1", NOW);
    expect(await evaluate()).toEqual([]);
  });
});

test("pantalla de retos: avance de los activos y fecha de los completados", async () => {
  const envase = await challenge({ metric: "BRING_CONTAINER_count", target: 2 });
  const reciclaje = await challenge({ metric: "RECYCLE_pieces", target: 30 });
  await container("s1", days(-2));
  await container("s2", days(-1));
  await evaluate();

  const list = await challengesForUser(db, userId, NOW);
  expect(list.find((c) => c.id === envase.id)).toMatchObject({ value: 2, progressPct: 100, completedAt: NOW });
  expect(list.find((c) => c.id === reciclaje.id)).toMatchObject({ value: 0, progressPct: 0, completedAt: null });
});
