// Canjes: cupón de un solo uso, stock, donaciones y nunca saldo negativo.
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createTestDb, resetDb } from "../../test/db";
import { couponQrContent, normalizeCouponCode } from "./coupon-code";
import { balanceOf } from "./points/ledger";
import { newCouponCode, redeemReward, markCouponUsed } from "./redemptions";

const db = createTestDb();
afterAll(() => db.$disconnect());

const NOW = new Date("2026-11-20T18:00:00Z");
let anaId: string;
let operatorId: string;

beforeEach(async () => {
  await resetDb(db);
  anaId = (await db.user.create({ data: { name: "Ana", email: "ana@t.test", passwordHash: "x" } })).id;
  operatorId = (
    await db.user.create({ data: { name: "Op", email: "op@t.test", passwordHash: "x", role: "OPERATOR" } })
  ).id;
  await db.pointEntry.create({ data: { userId: anaId, type: "ADJUSTMENT", points: 500, sourceId: "saldo-inicial" } });
  await db.reward.createMany({
    data: [
      { id: "cupon", name: "Cupón de $10", cost: 100, stock: 2 },
      { id: "bolsa", name: "Bolsa de tela", cost: 600, stock: 5 },
      { id: "agotado", name: "Termo", cost: 50, stock: 0 },
      { id: "arbol", name: "Donar un árbol", cost: 300, stock: 1000, isDonation: true },
    ],
  });
});

const redeem = (rewardId: string, userId = anaId) =>
  db.$transaction((tx) => redeemReward(tx, { userId, rewardId, now: NOW }));
const use = (code: string, operator = operatorId) =>
  db.$transaction((tx) => markCouponUsed(tx, { operatorId: operator, code, now: NOW }));

describe("código del cupón", () => {
  test("formato fácil de dictar", () => {
    for (let i = 0; i < 50; i++) expect(newCouponCode()).toMatch(/^ECO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  test("acepta el texto del QR o el código escrito a mano", () => {
    expect(normalizeCouponCode(couponQrContent("ECO-7KQ2-MX4P"))).toBe("ECO-7KQ2-MX4P");
    expect(normalizeCouponCode(" eco 7kq2 mx4p ")).toBe("ECO-7KQ2-MX4P");
    expect(normalizeCouponCode("cupón:ECO7KQ2MX4P")).toBe("ECO-7KQ2-MX4P");
    expect(normalizeCouponCode("ECO-123")).toBeNull();
    expect(normalizeCouponCode("bin:CAMPUS-01")).toBeNull();
  });
});

describe("canjear", () => {
  test("descuenta puntos y stock y genera un cupón sin usar", async () => {
    const { redemption, balance } = await redeem("cupon");
    expect(balance).toBe(400);
    expect(redemption.usedAt).toBeNull();
    expect((await db.reward.findUniqueOrThrow({ where: { id: "cupon" } })).stock).toBe(1);
    const entry = await db.pointEntry.findFirstOrThrow({ where: { sourceId: redemption.id } });
    expect(entry).toMatchObject({ type: "REDEEM", points: -100 });
  });

  test("sin saldo suficiente no canjea ni toca el stock", async () => {
    await expect(redeem("bolsa")).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
    expect((await db.reward.findUniqueOrThrow({ where: { id: "bolsa" } })).stock).toBe(5);
    expect(await db.redemption.count()).toBe(0);
    expect(await balanceOf(db, anaId)).toBe(500);
  });

  test("sin stock no se puede", async () => {
    await expect(redeem("agotado")).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    await redeem("cupon");
    await redeem("cupon");
    await expect(redeem("cupon")).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
  });

  test("donar a árboles: movimiento de donación, ya registrado como usado", async () => {
    const { redemption } = await redeem("arbol");
    expect(redemption.usedAt).toEqual(NOW);
    expect(await db.pointEntry.findFirstOrThrow({ where: { sourceId: redemption.id } })).toMatchObject({
      type: "DONATION",
      points: -300,
    });
    await expect(use(redemption.code)).rejects.toMatchObject({ code: "NOT_A_COUPON" });
  });
});

describe("usar el cupón en la caja", () => {
  test("se marca una sola vez, con quién lo marcó", async () => {
    const { redemption } = await redeem("cupon");
    expect(await use(couponQrContent(redemption.code))).toMatchObject({ code: redemption.code, customer: "Ana" });
    expect(await db.redemption.findUniqueOrThrow({ where: { id: redemption.id } })).toMatchObject({
      usedAt: NOW,
      usedById: operatorId,
    });
    await expect(use(redemption.code)).rejects.toMatchObject({ code: "ALREADY_USED" });
  });

  test("código inexistente o cupón propio", async () => {
    await expect(use("ECO-AAAA-BBBB")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(use("lo que sea")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const { redemption } = await redeem("cupon");
    await expect(use(redemption.code, anaId)).rejects.toMatchObject({ code: "OWN_COUPON" });
  });
});
