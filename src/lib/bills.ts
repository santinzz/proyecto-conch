// Recibos de luz y agua (Fase 4).
//
// Flujo: el cliente sube la foto o el PDF → queda un BORRADOR con lo que leyó el
// OCR → el cliente confirma o corrige los datos y lo envía (PENDING) → el operador
// lo aprueba (se acreditan puntos por reducción con creditBillReduction) o lo
// rechaza con motivo. Un recibo rechazado se puede corregir y reenviar, o borrar.
//
// Antifraude (SPEC.md, "Recibos"):
// - fileHash único: el mismo archivo no se sube dos veces.
// - Un número de servicio pertenece a una sola cuenta (ServiceAccount).
// - [kind, serviceNumber, periodStart] único y sin periodos encimados.
// - Revisión detallada si no hubo OCR, si lo confirmado difiere del OCR o si la
//   reducción supera 50%.
import { z } from "zod";
import type { BillKind } from "@/generated/prisma/enums";
import { type BillMimeType, sha256Hex } from "@/lib/bills/file";
import { MAX_PERIOD_DAYS, MIN_PERIOD_DAYS, type ParsedBill } from "@/lib/bills/parse";
import { type BillReading, billReduction, needsDetailedReview } from "@/lib/points/bill";
import { creditBillReduction, loadRules, type Tx } from "@/lib/points/ledger";

export type BillErrorCode =
  | "UNSUPPORTED_FILE"
  | "FILE_TOO_BIG"
  | "DUPLICATE_FILE"
  | "NOT_FOUND"
  | "NOT_EDITABLE"
  | "INVALID_DATA"
  | "SERVICE_TAKEN"
  | "DUPLICATE_PERIOD"
  | "NOT_PENDING"
  | "OWN_BILL"
  | "NOTE_REQUIRED";

export const BILL_ERROR_MESSAGES: Record<BillErrorCode, string> = {
  UNSUPPORTED_FILE: "Sube una foto (JPG, PNG o WebP) o el PDF del recibo",
  FILE_TOO_BIG: "El archivo pesa más de 4 MB",
  DUPLICATE_FILE: "Este archivo ya se subió antes",
  NOT_FOUND: "Recibo no encontrado",
  NOT_EDITABLE: "Este recibo ya se envió y no se puede cambiar",
  INVALID_DATA: "Revisa los datos del recibo",
  SERVICE_TAKEN: "Ese número de servicio ya está registrado en otra cuenta",
  DUPLICATE_PERIOD: "Ya hay un recibo de ese servicio para ese periodo",
  NOT_PENDING: "Este recibo ya se revisó",
  OWN_BILL: "No puedes validar tu propio recibo",
  NOTE_REQUIRED: "Escribe el motivo del rechazo",
};

export const BILL_ERROR_STATUS: Record<BillErrorCode, number> = {
  UNSUPPORTED_FILE: 415,
  FILE_TOO_BIG: 413,
  DUPLICATE_FILE: 409,
  NOT_FOUND: 404,
  NOT_EDITABLE: 409,
  INVALID_DATA: 400,
  SERVICE_TAKEN: 409,
  DUPLICATE_PERIOD: 409,
  NOT_PENDING: 409,
  OWN_BILL: 403,
  NOTE_REQUIRED: 400,
};

export class BillError extends Error {
  constructor(
    public readonly code: BillErrorCode,
    message: string = BILL_ERROR_MESSAGES[code],
  ) {
    super(message);
    this.name = "BillError";
  }
}

const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === "P2002";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Días que dos periodos pueden compartir (CFE empieza un periodo el día que termina el anterior). */
const OVERLAP_TOLERANCE_DAYS = 3;

// ---------------------------------------------------------------- entradas

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
  .transform((s) => new Date(`${s}T00:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Fecha no válida");

export const billKindSchema = z.enum(["ELECTRICITY", "WATER"]);

export const submitBillSchema = z.object({
  serviceNumber: z
    .string()
    .transform((s) => s.toUpperCase().replace(/\s+/g, ""))
    .pipe(z.string().regex(/^[A-Z0-9-]{4,20}$/, "Número de servicio no válido")),
  periodStart: isoDate,
  periodEnd: isoDate,
  consumption: z.number().finite().min(0, "El consumo no puede ser negativo").max(100_000, "Consumo demasiado alto"),
});
export type SubmitBillInput = z.infer<typeof submitBillSchema>;

export const reviewBillSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(300).optional(),
});

/** Reglas que dependen del tipo de recibo y de la fecha actual. */
function validateSubmission(kind: BillKind, data: SubmitBillInput, now: Date) {
  if (kind === "ELECTRICITY" && !/^\d{10,14}$/.test(data.serviceNumber)) {
    throw new BillError("INVALID_DATA", "El número de servicio de CFE son 12 dígitos");
  }
  const days = Math.round((data.periodEnd.getTime() - data.periodStart.getTime()) / DAY_MS);
  if (days < MIN_PERIOD_DAYS || days > MAX_PERIOD_DAYS) {
    throw new BillError("INVALID_DATA", `El periodo debe durar entre ${MIN_PERIOD_DAYS} y ${MAX_PERIOD_DAYS} días`);
  }
  if (data.periodEnd.getTime() > now.getTime() + DAY_MS) {
    throw new BillError("INVALID_DATA", "El periodo no puede terminar en el futuro");
  }
}

function toReading(bill: { periodStart: Date | null; periodEnd: Date | null; consumption: number | null }): BillReading {
  if (!bill.periodStart || !bill.periodEnd || bill.consumption === null) {
    throw new Error("Al recibo le faltan datos confirmados");
  }
  return { periodStart: bill.periodStart, periodEnd: bill.periodEnd, consumption: bill.consumption };
}

/** Recibo APROBADO anterior del mismo servicio (base de la comparación). */
function previousApproved(tx: Tx, input: { kind: BillKind; serviceNumber: string; before: Date; excludeId: string }) {
  return tx.bill.findFirst({
    where: {
      id: { not: input.excludeId },
      kind: input.kind,
      serviceNumber: input.serviceNumber,
      status: "APPROVED",
      periodStart: { lt: input.before },
    },
    orderBy: { periodStart: "desc" },
  });
}

/**
 * Estimación de puntos de un recibo con datos confirmados, contra el recibo
 * aprobado anterior del mismo servicio. null si todavía es borrador.
 */
export async function estimateBill(
  client: Tx,
  bill: {
    id: string;
    kind: BillKind;
    serviceNumber: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    consumption: number | null;
  },
) {
  if (!bill.serviceNumber || !bill.periodStart || !bill.periodEnd || bill.consumption === null) return null;
  const rules = await loadRules(client);
  const prev = await previousApproved(client, {
    kind: bill.kind,
    serviceNumber: bill.serviceNumber,
    before: bill.periodStart,
    excludeId: bill.id,
  });
  const estimate = billReduction(prev ? toReading(prev) : null, toReading(bill), {
    pointsPer5Pct: rules.BILL_REDUCTION.points,
    maxPerBill: rules.BILL_REDUCTION.limitCount,
  });
  return { prev, estimate };
}

// ---------------------------------------------------------------- subir

/** Crea el borrador con el archivo y lo que leyó el OCR (null si no se pudo leer). */
export async function createBillDraft(
  client: Tx,
  input: {
    userId: string;
    kind: BillKind;
    bytes: Uint8Array;
    mimeType: BillMimeType;
    ocr: { parsed: ParsedBill; confidence: number } | null;
    now?: Date;
  },
) {
  const fileHash = sha256Hex(input.bytes);
  const existing = await client.bill.findUnique({ where: { fileHash }, select: { id: true } });
  if (existing) throw new BillError("DUPLICATE_FILE");
  try {
    return await client.bill.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        fileHash,
        ocrServiceNumber: input.ocr?.parsed.serviceNumber ?? null,
        ocrPeriodStart: input.ocr?.parsed.periodStart ?? null,
        ocrPeriodEnd: input.ocr?.parsed.periodEnd ?? null,
        ocrConsumption: input.ocr?.parsed.consumption ?? null,
        ocrConfidence: input.ocr?.confidence ?? null,
        createdAt: input.now ?? new Date(),
        file: {
          create: { mimeType: input.mimeType, size: input.bytes.byteLength, data: new Uint8Array(input.bytes) },
        },
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new BillError("DUPLICATE_FILE");
    throw e;
  }
}

// ---------------------------------------------------------------- confirmar y enviar

/**
 * El cliente confirma o corrige los datos y envía el recibo a validación.
 * Debe llamarse dentro de db.$transaction.
 */
export async function submitBill(tx: Tx, input: { userId: string; billId: string; data: SubmitBillInput; now?: Date }) {
  const now = input.now ?? new Date();
  const { data } = input;
  const bill = await tx.bill.findFirst({ where: { id: input.billId, userId: input.userId } });
  if (!bill) throw new BillError("NOT_FOUND");
  if (bill.status !== "DRAFT" && bill.status !== "REJECTED") throw new BillError("NOT_EDITABLE");
  validateSubmission(bill.kind, data, now);

  // El número de servicio no puede ser de otra cuenta (ni estar en un recibo pendiente de otra persona).
  const account = await tx.serviceAccount.findUnique({
    where: { kind_number: { kind: bill.kind, number: data.serviceNumber } },
  });
  const otherPending = await tx.bill.findFirst({
    where: {
      kind: bill.kind,
      serviceNumber: data.serviceNumber,
      userId: { not: input.userId },
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { id: true },
  });
  if ((account && account.userId !== input.userId) || otherPending) throw new BillError("SERVICE_TAKEN");

  // Mismo periodo o periodos encimados del mismo servicio.
  const tolerance = OVERLAP_TOLERANCE_DAYS * DAY_MS;
  const overlapping = await tx.bill.findFirst({
    where: {
      id: { not: bill.id },
      kind: bill.kind,
      serviceNumber: data.serviceNumber,
      status: { in: ["PENDING", "APPROVED"] },
      periodStart: { lt: new Date(data.periodEnd.getTime() - tolerance) },
      periodEnd: { gt: new Date(data.periodStart.getTime() + tolerance) },
    },
    select: { id: true },
  });
  if (overlapping) throw new BillError("DUPLICATE_PERIOD");

  // Estimación con el recibo aprobado anterior (el cálculo definitivo se hace al aprobar).
  const rules = await loadRules(tx);
  const prev = await previousApproved(tx, {
    kind: bill.kind,
    serviceNumber: data.serviceNumber,
    before: data.periodStart,
    excludeId: bill.id,
  });
  const estimate = billReduction(prev ? toReading(prev) : null, data, {
    pointsPer5Pct: rules.BILL_REDUCTION.points,
    maxPerBill: rules.BILL_REDUCTION.limitCount,
  });
  const ocrDisagrees =
    (bill.ocrServiceNumber !== null && bill.ocrServiceNumber !== data.serviceNumber) ||
    (bill.ocrPeriodStart !== null && Math.abs(bill.ocrPeriodStart.getTime() - data.periodStart.getTime()) > tolerance);
  const detailedReview =
    ocrDisagrees ||
    needsDetailedReview({ confirmed: data.consumption, ocr: bill.ocrConsumption, reductionPct: estimate.reductionPct });

  try {
    const updated = await tx.bill.updateMany({
      where: { id: bill.id, status: { in: ["DRAFT", "REJECTED"] } },
      data: {
        serviceNumber: data.serviceNumber,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        consumption: data.consumption,
        status: "PENDING",
        detailedReview,
        submittedAt: now,
        reviewNote: null,
        reviewedById: null,
        reviewedAt: null,
      },
    });
    if (updated.count !== 1) throw new BillError("NOT_EDITABLE");
  } catch (e) {
    if (isUniqueViolation(e)) throw new BillError("DUPLICATE_PERIOD");
    throw e;
  }
  return { status: "PENDING" as const, detailedReview, estimate };
}

// ---------------------------------------------------------------- revisar (operador)

/**
 * El operador aprueba (acredita puntos) o rechaza con motivo.
 * Debe llamarse dentro de db.$transaction.
 */
export async function reviewBill(
  tx: Tx,
  input: {
    reviewerId: string;
    billId: string;
    action: "approve" | "reject";
    note?: string;
    feSen: number;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const bill = await tx.bill.findUnique({ where: { id: input.billId } });
  if (!bill) throw new BillError("NOT_FOUND");
  if (bill.userId === input.reviewerId) throw new BillError("OWN_BILL");
  if (bill.status !== "PENDING") throw new BillError("NOT_PENDING");
  const note = input.note?.trim() || null;

  if (input.action === "reject") {
    if (!note || note.length < 3) throw new BillError("NOTE_REQUIRED");
    const updated = await tx.bill.updateMany({
      where: { id: bill.id, status: "PENDING" },
      data: { status: "REJECTED", reviewNote: note, reviewedById: input.reviewerId, reviewedAt: now },
    });
    if (updated.count !== 1) throw new BillError("NOT_PENDING");
    return { status: "REJECTED" as const };
  }

  const serviceNumber = bill.serviceNumber;
  if (!serviceNumber) throw new Error("Al recibo le falta el número de servicio");
  const curr = toReading(bill);

  // Al aprobar, el número de servicio queda ligado a esta cuenta.
  const account = await tx.serviceAccount.findUnique({
    where: { kind_number: { kind: bill.kind, number: serviceNumber } },
  });
  if (account && account.userId !== bill.userId) throw new BillError("SERVICE_TAKEN");
  if (!account) {
    try {
      await tx.serviceAccount.create({ data: { kind: bill.kind, number: serviceNumber, userId: bill.userId } });
    } catch (e) {
      if (isUniqueViolation(e)) throw new BillError("SERVICE_TAKEN");
      throw e;
    }
  }

  // Marca el recibo solo si sigue pendiente (a prueba de dos operadores a la vez).
  const updated = await tx.bill.updateMany({
    where: { id: bill.id, status: "PENDING" },
    data: { status: "APPROVED", reviewNote: note, reviewedById: input.reviewerId, reviewedAt: now },
  });
  if (updated.count !== 1) throw new BillError("NOT_PENDING");

  const prev = await previousApproved(tx, {
    kind: bill.kind,
    serviceNumber,
    before: curr.periodStart,
    excludeId: bill.id,
  });
  const credit = await creditBillReduction(tx, {
    userId: bill.userId,
    billId: bill.id,
    kind: bill.kind,
    prev: prev ? toReading(prev) : null,
    curr,
    feSen: input.feSen,
    now,
  });
  return {
    status: "APPROVED" as const,
    points: credit.entry.points,
    baseline: credit.baseline,
    reductionPct: credit.reductionPct,
    saved: credit.saved,
  };
}

// ---------------------------------------------------------------- borrar

/** El cliente puede borrar sus borradores y sus recibos rechazados (con el archivo). */
export async function deleteBill(client: Tx, input: { userId: string; billId: string }) {
  const deleted = await client.bill.deleteMany({
    where: { id: input.billId, userId: input.userId, status: { in: ["DRAFT", "REJECTED"] } },
  });
  if (deleted.count === 1) return;
  const exists = await client.bill.findFirst({ where: { id: input.billId, userId: input.userId }, select: { id: true } });
  throw new BillError(exists ? "NOT_EDITABLE" : "NOT_FOUND");
}
