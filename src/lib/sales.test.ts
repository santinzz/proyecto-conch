// Pruebas de integración de la caja y el QR del ticket (criterios de la Fase 3).
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createTestDb, resetDb } from "../../test/db";
import { balanceOf } from "./points/ledger";
import { signTicket } from "./qr";
import { claimSale, createSale, SaleError } from "./sales";

const db = createTestDb();
afterAll(() => db.$disconnect());

const SECRET = "q".repeat(40);
const NOW = new Date("2026-11-20T18:00:00Z"); // viernes 12:00 CDMX
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

let operatorId: string;
let clientId: string;

beforeEach(async () => {
  await resetDb(db);
  operatorId = (await db.user.create({ data: { name: "Op", email: "op@t.test", passwordHash: "x", role: "OPERATOR" } })).id;
  clientId = (await db.user.create({ data: { name: "Ana", email: "ana@t.test", passwordHash: "x" } })).id;
  await db.product.createMany({
    data: [
      { id: "jabon", name: "Jabón a granel", priceCents: 4500, bulk: true, local: true, plasticFree: true }, // A
      { id: "cepillo", name: "Cepillo de bambú", priceCents: 3000, plasticFree: true, certified: true }, // B
      { id: "galletas", name: "Galletas", priceCents: 3000 }, // sin Eco Score
      { id: "viejo", name: "Producto inactivo", priceCents: 1000, local: true, active: false },
    ],
  });
});

const sell = (items: { productId: string; qty: number }[], broughtContainer = false, now = NOW) =>
  createSale(db, { operatorId, items, broughtContainer, secret: SECRET, now });

const claim = (token: string, userId = clientId, now = minutes(1)) =>
  db.$transaction((tx) => claimSale(tx, { userId, token, secret: SECRET, now }));

describe("crear venta", () => {
  test("toma precios y Eco Score de la base de datos y calcula puntos base", async () => {
    const { sale, lines, token } = await sell([
      { productId: "jabon", qty: 1 },
      { productId: "cepillo", qty: 2 },
      { productId: "galletas", qty: 1 },
    ]);
    expect(sale.totalCents).toBe(4500 + 6000 + 3000);
    expect(sale.points).toBe(12 + 12); // A: 4×3, B: 6×2, galletas 0
    expect(lines.find((l) => l.productId === "jabon")?.ecoScore).toBe("A");
    expect(sale.expiresAt).toEqual(minutes(15));
    expect(token.startsWith(`${sale.id}.`)).toBe(true);
  });

  test("junta renglones repetidos", async () => {
    const { lines } = await sell([{ productId: "jabon", qty: 1 }, { productId: "jabon", qty: 2 }]);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(3);
  });

  test("venta vacía sin envase no se permite; solo envase sí", async () => {
    await expect(sell([])).rejects.toMatchObject({ code: "EMPTY_SALE" });
    const { sale } = await sell([], true);
    expect(sale.totalCents).toBe(0);
  });

  test("producto inexistente o inactivo se rechaza", async () => {
    await expect(sell([{ productId: "viejo", qty: 1 }])).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
    await expect(sell([{ productId: "nada", qty: 1 }])).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
  });
});

describe("reclamar el QR", () => {
  test("acredita los puntos una vez y marca la venta", async () => {
    const { sale, token } = await sell([{ productId: "jabon", qty: 1 }]);
    const r = await claim(token);
    expect(r).toMatchObject({ purchasePoints: 12, containerPoints: 0, totalPoints: 12 });
    expect(await balanceOf(db, clientId)).toBe(12);
    const updated = await db.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(updated.claimedById).toBe(clientId);
    expect(updated.claimedAt).toEqual(minutes(1));
  });

  test("el segundo intento falla y no cambia el saldo", async () => {
    const { token } = await sell([{ productId: "jabon", qty: 1 }]);
    await claim(token);
    await expect(claim(token)).rejects.toMatchObject({ code: "ALREADY_CLAIMED" });
    const otro = (await db.user.create({ data: { name: "Beto", email: "b@t.test", passwordHash: "x" } })).id;
    await expect(claim(token, otro)).rejects.toMatchObject({ code: "ALREADY_CLAIMED" });
    expect(await balanceOf(db, clientId)).toBe(12);
    expect(await balanceOf(db, otro)).toBe(0);
  });

  test("dos escaneos simultáneos: solo uno gana", async () => {
    const { token } = await sell([{ productId: "jabon", qty: 1 }]);
    const otro = (await db.user.create({ data: { name: "Beto", email: "b@t.test", passwordHash: "x" } })).id;
    const results = await Promise.allSettled([claim(token), claim(token, otro)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await balanceOf(db, clientId)) + (await balanceOf(db, otro))).toBe(12);
  });

  test("un QR vencido falla", async () => {
    const { token } = await sell([{ productId: "jabon", qty: 1 }]);
    await expect(claim(token, clientId, minutes(15))).rejects.toMatchObject({ code: "EXPIRED" });
    await expect(claim(token, clientId, minutes(60))).rejects.toMatchObject({ code: "EXPIRED" });
    expect(await balanceOf(db, clientId)).toBe(0);
  });

  test("un QR alterado o con nonce viejo falla", async () => {
    const { sale, token } = await sell([{ productId: "jabon", qty: 1 }]);
    await expect(claim(token.slice(0, -3) + "xyz")).rejects.toMatchObject({ code: "INVALID_TICKET" });
    const forged = signTicket({ saleId: sale.id, nonce: "otroNonce", expiresAt: sale.expiresAt }, SECRET);
    await expect(claim(forged)).rejects.toMatchObject({ code: "INVALID_TICKET" });
    const wrongSecret = signTicket({ saleId: sale.id, nonce: sale.qrNonce, expiresAt: sale.expiresAt }, "z".repeat(40));
    await expect(claim(wrongSecret)).rejects.toBeInstanceOf(SaleError);
  });

  test("el operador no puede reclamar su propia venta", async () => {
    const { token } = await sell([{ productId: "jabon", qty: 1 }]);
    await expect(claim(token, operatorId)).rejects.toMatchObject({ code: "OWN_SALE" });
  });

  test("aplica el bono de nivel de quien reclama", async () => {
    await db.pointEntry.create({ data: { userId: clientId, type: "ADJUSTMENT", points: 500, sourceId: "adj", createdAt: NOW } });
    const { token } = await sell([{ productId: "jabon", qty: 10 }]); // $450 → 45 × 3 = 135
    const r = await claim(token);
    expect(r).toMatchObject({ purchasePoints: 148, levelBonus: 13 });
  });
});

describe("trajo su envase", () => {
  test("suma 10 puntos al reclamar", async () => {
    const { token } = await sell([{ productId: "jabon", qty: 1 }], true);
    expect(await claim(token)).toMatchObject({ purchasePoints: 12, containerPoints: 10, totalPoints: 22 });
  });

  test("solo envase, sin compra", async () => {
    const { token } = await sell([], true);
    expect(await claim(token)).toMatchObject({ purchasePoints: 0, containerPoints: 10, totalPoints: 10 });
  });

  test("respeta el límite de uno por día entre ventas distintas", async () => {
    const first = await sell([{ productId: "jabon", qty: 1 }], true);
    await claim(first.token);
    const second = await sell([{ productId: "cepillo", qty: 1 }], true, minutes(30));
    const r = await claim(second.token, clientId, minutes(31));
    expect(r).toMatchObject({ purchasePoints: 6, containerPoints: 0, containerLimitReached: true });
    expect(await balanceOf(db, clientId)).toBe(12 + 10 + 6);
    expect(await db.pointEntry.count({ where: { type: "BRING_CONTAINER" } })).toBe(2); // cuenta como envase
  });

  test("al día siguiente vuelve a pagar", async () => {
    const first = await sell([], true);
    await claim(first.token);
    const tomorrow = new Date("2026-11-21T16:00:00Z");
    const second = await sell([], true, tomorrow);
    expect(await claim(second.token, clientId, new Date(tomorrow.getTime() + 60_000))).toMatchObject({ containerPoints: 10 });
  });
});
