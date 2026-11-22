// Pruebas de integración de recibos (criterios de la Fase 4).
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createTestDb, resetDb } from "../../test/db";
import {
  BillError,
  createBillDraft,
  deleteBill,
  reviewBill,
  type SubmitBillInput,
  submitBill,
  submitBillSchema,
} from "./bills";
import type { ParsedBill } from "./bills/parse";
import { balanceOf } from "./points/ledger";

const db = createTestDb();
afterAll(() => db.$disconnect());

const NOW = new Date("2026-11-20T18:00:00Z");
const FE_SEN = 0.5;
const SERVICE = "123456789012";

let anaId: string;
let betoId: string;
let operatorId: string;

beforeEach(async () => {
  await resetDb(db);
  const user = (name: string, email: string, role: "CUSTOMER" | "OPERATOR" = "CUSTOMER") =>
    db.user.create({ data: { name, email, passwordHash: "x", role } });
  anaId = (await user("Ana", "ana@t.test")).id;
  betoId = (await user("Beto", "beto@t.test")).id;
  operatorId = (await user("Op", "op@t.test", "OPERATOR")).id;
});

let fileCounter = 0;
const ocrOf = (o: Partial<ParsedBill>): ParsedBill => ({
  serviceNumber: null,
  periodStart: null,
  periodEnd: null,
  consumption: null,
  ...o,
});

/** Sube un archivo distinto cada vez (o el contenido indicado). */
function upload(userId: string, opts: { content?: string; ocr?: ParsedBill | null } = {}) {
  const content = opts.content ?? `%PDF-1.7 recibo ${++fileCounter}`;
  return createBillDraft(db, {
    userId,
    kind: "ELECTRICITY",
    bytes: new TextEncoder().encode(content),
    mimeType: "application/pdf",
    ocr: opts.ocr === undefined ? null : opts.ocr && { parsed: opts.ocr, confidence: 0.9 },
    now: NOW,
  });
}

const data = (start: string, end: string, consumption: number, serviceNumber = SERVICE): SubmitBillInput =>
  submitBillSchema.parse({ serviceNumber, periodStart: start, periodEnd: end, consumption });

const submit = (userId: string, billId: string, input: SubmitBillInput) =>
  db.$transaction((tx) => submitBill(tx, { userId, billId, data: input, now: NOW }));

const review = (billId: string, action: "approve" | "reject", note?: string, reviewerId = operatorId) =>
  db.$transaction((tx) => reviewBill(tx, { reviewerId, billId, action, note, feSen: FE_SEN, now: NOW }));

// Dos periodos bimestrales seguidos de 60 días.
const P1 = ["2026-07-15", "2026-09-13"] as const;
const P2 = ["2026-09-13", "2026-11-12"] as const;

/** Recibo enviado y aprobado. */
async function approved(userId: string, period: readonly [string, string], consumption: number) {
  const bill = await upload(userId);
  await submit(userId, bill.id, data(period[0], period[1], consumption));
  return { bill, result: await review(bill.id, "approve") };
}

describe("subir", () => {
  test("guarda el borrador con el archivo y lo leído por el OCR", async () => {
    const bill = await upload(anaId, { ocr: ocrOf({ serviceNumber: SERVICE, consumption: 300 }) });
    expect(bill.status).toBe("DRAFT");
    expect(bill.ocrServiceNumber).toBe(SERVICE);
    expect(bill.ocrConsumption).toBe(300);
    const file = await db.billFile.findUnique({ where: { billId: bill.id } });
    expect(file?.mimeType).toBe("application/pdf");
  });

  test("el mismo archivo no se sube dos veces (ni por otra cuenta)", async () => {
    await upload(anaId, { content: "%PDF-1.7 mismo" });
    await expect(upload(betoId, { content: "%PDF-1.7 mismo" })).rejects.toMatchObject({ code: "DUPLICATE_FILE" });
  });
});

describe("confirmar y enviar", () => {
  test("pasa a pendiente; el primer recibo es línea base", async () => {
    const bill = await upload(anaId, { ocr: ocrOf({ serviceNumber: SERVICE, consumption: 300 }) });
    const result = await submit(anaId, bill.id, data(...P1, 300));
    expect(result).toMatchObject({ status: "PENDING", detailedReview: false, estimate: { baseline: true, points: 0 } });
    const saved = await db.bill.findUniqueOrThrow({ where: { id: bill.id } });
    expect(saved).toMatchObject({ status: "PENDING", serviceNumber: SERVICE, consumption: 300 });
  });

  test("revisión detallada: sin OCR, OCR distinto en más de 10% o servicio distinto al leído", async () => {
    const noOcr = await upload(anaId);
    expect((await submit(anaId, noOcr.id, data(...P1, 300))).detailedReview).toBe(true);

    const differs = await upload(betoId, { ocr: ocrOf({ consumption: 300 }) });
    expect((await submit(betoId, differs.id, data(...P1, 250, "111222333444"))).detailedReview).toBe(true);

    const otherService = await upload(betoId, { ocr: ocrOf({ serviceNumber: "999999999999", consumption: 300 }) });
    expect((await submit(betoId, otherService.id, data(...P2, 300, "111222333444"))).detailedReview).toBe(true);
  });

  test("reducción mayor a 50% se revisa con lupa", async () => {
    await approved(anaId, P1, 300);
    const bill = await upload(anaId, { ocr: ocrOf({ serviceNumber: SERVICE, consumption: 100 }) });
    const result = await submit(anaId, bill.id, data(...P2, 100));
    expect(result.estimate.reductionPct).toBeGreaterThan(50);
    expect(result.detailedReview).toBe(true);
  });

  test("número de servicio de otra cuenta se rechaza", async () => {
    await approved(anaId, P1, 300);
    const bill = await upload(betoId);
    await expect(submit(betoId, bill.id, data(...P2, 250))).rejects.toMatchObject({ code: "SERVICE_TAKEN" });
  });

  test("tampoco si el servicio está en un recibo pendiente de otra persona", async () => {
    const ana = await upload(anaId);
    await submit(anaId, ana.id, data(...P1, 300));
    const beto = await upload(betoId);
    await expect(submit(betoId, beto.id, data(...P2, 250))).rejects.toMatchObject({ code: "SERVICE_TAKEN" });
  });

  test("periodo repetido o encimado se rechaza", async () => {
    await approved(anaId, P1, 300);
    const same = await upload(anaId);
    await expect(submit(anaId, same.id, data(...P1, 280))).rejects.toMatchObject({ code: "DUPLICATE_PERIOD" });
    const shifted = await upload(anaId);
    await expect(submit(anaId, shifted.id, data("2026-07-25", "2026-09-20", 280))).rejects.toMatchObject({
      code: "DUPLICATE_PERIOD",
    });
  });

  test("datos inválidos: periodo muy corto, en el futuro o servicio de CFE mal escrito", async () => {
    const bill = await upload(anaId);
    await expect(submit(anaId, bill.id, data("2026-09-01", "2026-09-10", 100))).rejects.toMatchObject({
      code: "INVALID_DATA",
    });
    await expect(submit(anaId, bill.id, data("2026-11-01", "2026-12-30", 100))).rejects.toMatchObject({
      code: "INVALID_DATA",
    });
    await expect(submit(anaId, bill.id, data(...P1, 100, "ABC-12"))).rejects.toMatchObject({ code: "INVALID_DATA" });
    expect(() => data(...P1, -5)).toThrow();
  });

  test("un recibo enviado ya no se puede cambiar; solo el dueño lo ve", async () => {
    const bill = await upload(anaId);
    await expect(submit(betoId, bill.id, data(...P1, 300))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await submit(anaId, bill.id, data(...P1, 300));
    await expect(submit(anaId, bill.id, data(...P1, 200))).rejects.toMatchObject({ code: "NOT_EDITABLE" });
  });
});

describe("revisar", () => {
  test("el primer recibo aprobado es línea base: 0 puntos", async () => {
    const { result } = await approved(anaId, P1, 300);
    expect(result).toMatchObject({ status: "APPROVED", baseline: true, points: 0 });
    expect(await balanceOf(db, anaId)).toBe(0);
    expect(await db.serviceAccount.count({ where: { userId: anaId } })).toBe(1);
  });

  test("el segundo aprobado acredita por reducción y registra kWh y CO₂", async () => {
    await approved(anaId, P1, 300); // 5 kWh/día
    const { bill, result } = await approved(anaId, P2, 240); // 4 kWh/día → 20% menos
    expect(result).toMatchObject({ status: "APPROVED", baseline: false, reductionPct: 20, points: 200, saved: 60 });
    const entry = await db.pointEntry.findFirstOrThrow({ where: { sourceId: bill.id } });
    expect(entry.points).toBe(200);
    expect(entry.impact).toEqual({ kwh: 60, co2Kg: 30 });
    expect(await balanceOf(db, anaId)).toBe(200);
  });

  test("no se paga dos veces: un recibo revisado no se vuelve a revisar", async () => {
    await approved(anaId, P1, 300);
    const { bill } = await approved(anaId, P2, 240);
    await expect(review(bill.id, "approve")).rejects.toMatchObject({ code: "NOT_PENDING" });
    expect(await balanceOf(db, anaId)).toBe(200);
  });

  test("rechazar exige motivo; el cliente corrige y reenvía", async () => {
    const bill = await upload(anaId);
    await submit(anaId, bill.id, data(...P1, 300));
    await expect(review(bill.id, "reject")).rejects.toMatchObject({ code: "NOTE_REQUIRED" });
    expect(await review(bill.id, "reject", "El consumo no coincide con la foto")).toEqual({ status: "REJECTED" });
    expect((await db.bill.findUniqueOrThrow({ where: { id: bill.id } })).reviewNote).toBe(
      "El consumo no coincide con la foto",
    );

    const again = await submit(anaId, bill.id, data(...P1, 310));
    expect(again.status).toBe("PENDING");
    expect(await db.bill.findUniqueOrThrow({ where: { id: bill.id } })).toMatchObject({
      status: "PENDING",
      consumption: 310,
      reviewNote: null,
    });
  });

  test("nadie valida su propio recibo", async () => {
    const bill = await upload(operatorId);
    await submit(operatorId, bill.id, data(...P1, 300));
    await expect(review(bill.id, "approve")).rejects.toMatchObject({ code: "OWN_BILL" });
  });

  test("un borrador no se puede revisar", async () => {
    const bill = await upload(anaId);
    await expect(review(bill.id, "approve")).rejects.toBeInstanceOf(BillError);
  });
});

describe("borrar", () => {
  test("solo borradores o rechazados, y se va el archivo", async () => {
    const draft = await upload(anaId);
    await deleteBill(db, { userId: anaId, billId: draft.id });
    expect(await db.billFile.count({ where: { billId: draft.id } })).toBe(0);

    const pending = await upload(anaId);
    await submit(anaId, pending.id, data(...P1, 300));
    await expect(deleteBill(db, { userId: anaId, billId: pending.id })).rejects.toMatchObject({ code: "NOT_EDITABLE" });
    await expect(deleteBill(db, { userId: betoId, billId: pending.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
