// Reciclaje: solicitud desde el QR del contenedor y confirmación del operador.
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createTestDb, resetDb } from "../../test/db";
import { balanceOf } from "./points/ledger";
import { createRecycleClaim, MAX_PENDING_CLAIMS, reviewRecycleClaim } from "./recycle";

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
  await db.recycleBin.create({ data: { name: "Contenedor", location: "Patio", code: "CAMPUS-01" } });
});

const claim = (pieces: number, userId = anaId, binCode = "CAMPUS-01") =>
  createRecycleClaim(db, { userId, binCode, pieces, now: NOW });
const review = (claimId: string, action: "approve" | "reject", pieces?: number, reviewerId = operatorId) =>
  db.$transaction((tx) => reviewRecycleClaim(tx, { reviewerId, claimId, action, pieces, now: NOW }));

describe("solicitud del cliente", () => {
  test("queda pendiente con las piezas indicadas", async () => {
    const c = await claim(6);
    expect(c).toMatchObject({ status: "PENDING", pieces: 6, userId: anaId });
  });

  test("piezas fuera de rango o contenedor que no existe", async () => {
    await expect(claim(0)).rejects.toMatchObject({ code: "INVALID_PIECES" });
    await expect(claim(101)).rejects.toMatchObject({ code: "INVALID_PIECES" });
    await expect(claim(2.5)).rejects.toMatchObject({ code: "INVALID_PIECES" });
    await expect(claim(3, anaId, "NO-EXISTE")).rejects.toMatchObject({ code: "BIN_NOT_FOUND" });
  });

  test(`no más de ${MAX_PENDING_CLAIMS} solicitudes pendientes por persona`, async () => {
    for (let i = 0; i < MAX_PENDING_CLAIMS; i++) await claim(1);
    await expect(claim(1)).rejects.toMatchObject({ code: "TOO_MANY_PENDING" });
  });
});

describe("revisión del operador", () => {
  test("aprueba con las piezas que contó y paga 5 por pieza", async () => {
    const c = await claim(10);
    const result = await review(c.id, "approve", 8);
    expect(result).toMatchObject({ status: "APPROVED", pieces: 8, paidPieces: 8, points: 40 });
    expect(await db.recycleClaim.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({
      status: "APPROVED",
      pieces: 10,
      confirmedPieces: 8,
      reviewedById: operatorId,
    });
    expect(await balanceOf(db, anaId)).toBe(40);
  });

  test("respeta el límite de 20 piezas pagadas por semana", async () => {
    const a = await claim(15);
    const b = await claim(10);
    await review(a.id, "approve");
    expect(await review(b.id, "approve")).toMatchObject({ pieces: 10, paidPieces: 5, points: 25 });
    expect(await balanceOf(db, anaId)).toBe(100);
  });

  test("rechazar no paga; una solicitud revisada no se vuelve a revisar", async () => {
    const c = await claim(5);
    expect(await review(c.id, "reject")).toEqual({ status: "REJECTED" });
    await expect(review(c.id, "approve")).rejects.toMatchObject({ code: "NOT_PENDING" });
    expect(await balanceOf(db, anaId)).toBe(0);
  });

  test("nadie confirma su propio reciclaje", async () => {
    const c = await claim(5, operatorId);
    await expect(review(c.id, "approve")).rejects.toMatchObject({ code: "OWN_CLAIM" });
  });

  test("al aprobar se revisan los retos", async () => {
    await db.challenge.create({
      data: {
        title: "Recicla 5",
        metric: "RECYCLE_pieces",
        target: 5,
        reward: 50,
        startsAt: new Date(NOW.getTime() - 86_400_000),
        endsAt: new Date(NOW.getTime() + 86_400_000),
      },
    });
    const c = await claim(5);
    expect(await review(c.id, "approve")).toMatchObject({ challenges: [{ title: "Recicla 5", reward: 50 }] });
    expect(await balanceOf(db, anaId)).toBe(25 + 50);
  });
});
