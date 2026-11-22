// Administración de personas: roles, ajustes y borrado de archivos al cerrar el piloto.
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createTestDb, resetDb } from "../../../test/db";
import { balanceOf } from "../points/ledger";
import { adjustUserPoints, billFileStats, purgeBillFiles, setUserRole } from "./users";

const db = createTestDb();
afterAll(() => db.$disconnect());

let adminId: string;
let anaId: string;

beforeEach(async () => {
  await resetDb(db);
  adminId = (await db.user.create({ data: { name: "Admin", email: "admin@t.test", passwordHash: "x", role: "ADMIN" } })).id;
  anaId = (await db.user.create({ data: { name: "Ana", email: "ana@t.test", passwordHash: "x" } })).id;
});

const adjust = (points: number, reason = "Corrección de prueba", userId = anaId) =>
  db.$transaction((tx) => adjustUserPoints(tx, { adminId, userId, points, reason }));

describe("roles", () => {
  test("el admin hace operadora a una clienta", async () => {
    expect(await setUserRole(db, { adminId, userId: anaId, role: "OPERATOR" })).toMatchObject({ role: "OPERATOR" });
  });

  test("nadie cambia su propio rol; la persona debe existir", async () => {
    await expect(setUserRole(db, { adminId, userId: adminId, role: "CUSTOMER" })).rejects.toMatchObject({
      code: "NOT_ALLOWED",
    });
    await expect(setUserRole(db, { adminId, userId: "no-existe", role: "OPERATOR" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("ajustes de puntos", () => {
  test("suma o resta con motivo y deja la evidencia", async () => {
    expect((await adjust(50)).balance).toBe(50);
    expect((await adjust(-20, "Se acreditó dos veces")).balance).toBe(30);
    const entries = await db.pointEntry.findMany({ where: { userId: anaId, type: "ADJUSTMENT" } });
    expect(entries.map((e) => e.points).sort()).toEqual([-20, 50]);
    expect(await db.adjustment.count({ where: { userId: anaId, adminId } })).toBe(2);
  });

  test("nunca deja saldo negativo", async () => {
    await adjust(10);
    await expect(adjust(-11)).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
    expect(await balanceOf(db, anaId)).toBe(10);
    expect(await db.adjustment.count()).toBe(1);
  });

  test("motivo obligatorio, cantidad válida y no a uno mismo", async () => {
    await expect(adjust(10, "ok")).rejects.toMatchObject({ code: "INVALID" });
    await expect(adjust(0)).rejects.toMatchObject({ code: "INVALID" });
    await expect(adjust(2.5)).rejects.toMatchObject({ code: "INVALID" });
    await expect(adjust(10, "Corrección", adminId)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });
});

test("cierre del piloto: borra los archivos de recibos revisados y conserva los pendientes", async () => {
  const bill = (fileHash: string, status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED") =>
    db.bill.create({
      data: {
        userId: anaId,
        kind: "ELECTRICITY",
        fileHash,
        status,
        serviceNumber: status === "DRAFT" ? null : `12345678901${fileHash.length}`,
        file: { create: { mimeType: "application/pdf", size: 100, data: new Uint8Array([37, 80, 68, 70]) } },
      },
    });
  await bill("a", "APPROVED");
  await bill("bb", "REJECTED");
  await bill("ccc", "DRAFT");
  await bill("dddd", "PENDING");
  expect(await billFileStats(db)).toEqual({ files: 4, bytes: 400, pending: 1 });

  expect(await purgeBillFiles(db)).toEqual({ deleted: 3 });
  expect(await billFileStats(db)).toEqual({ files: 1, bytes: 100, pending: 1 });
  expect(await db.bill.count()).toBe(4); // los datos del recibo se conservan
});
