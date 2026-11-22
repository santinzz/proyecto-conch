// Libro de puntos: la ÚNICA puerta para dar o quitar puntos.
//
// Reglas:
// - Cada función de escritura debe llamarse dentro de `db.$transaction(async (tx) => …)`
//   y recibe ese `tx`; así la evidencia (venta, recibo, reclamo…) y el PointEntry se
//   guardan juntos o no se guarda nada.
// - Antes de leer límites o saldo se bloquea la fila del usuario
//   (FOR NO KEY UPDATE) para que dos peticiones simultáneas no se salten el límite ni
//   dejen saldo negativo.
// - `@@unique([type, sourceId])` impide que la misma evidencia pague dos veces.
// - El saldo nunca se guarda: es la suma de PointEntry.
import { EntryType, type Prisma } from "@/generated/prisma/client";
import { type BillReading, billReduction } from "./bill";
import type { EcoScore } from "./eco-score";
import { billImpact, type ImpactData } from "./impact";
import { levelFor, levelWindowStart } from "./levels";
import { applyLimit, periodRange } from "./limits";
import { type PurchaseItem, purchasePoints } from "./purchase";
import { type LimitPeriod, RULE_KEYS, type RuleSet } from "./rules";
import { challengeSourceId } from "./challenge-metrics";

export type Tx = Prisma.TransactionClient;

export type PointsErrorCode = "ALREADY_CREDITED" | "INSUFFICIENT_BALANCE" | "USER_NOT_FOUND" | "RULES_MISSING";

export class PointsError extends Error {
  constructor(
    public readonly code: PointsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PointsError";
  }
}

// ---------------------------------------------------------------- lecturas

/** Saldo = suma de PointEntry. Sirve con `db` o con un `tx`. */
export async function balanceOf(client: Tx, userId: string): Promise<number> {
  const result = await client.pointEntry.aggregate({ where: { userId }, _sum: { points: true } });
  return result._sum.points ?? 0;
}

/** Puntos ganados (positivos, sin canjes ni donaciones) en los últimos 180 días. */
export async function earnedInLevelWindow(client: Tx, userId: string, now = new Date()): Promise<number> {
  const result = await client.pointEntry.aggregate({
    where: {
      userId,
      points: { gt: 0 },
      type: { notIn: [EntryType.REDEEM, EntryType.DONATION] },
      createdAt: { gte: levelWindowStart(now), lte: now },
    },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}

export async function loadRules(client: Tx): Promise<RuleSet> {
  const rows = await client.rule.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const missing = RULE_KEYS.filter((k) => !byKey.has(k));
  if (missing.length) throw new PointsError("RULES_MISSING", `Faltan reglas: ${missing.join(", ")}`);
  return Object.fromEntries(
    RULE_KEYS.map((k) => {
      const r = byKey.get(k)!;
      return [k, { points: r.points, limitCount: r.limitCount, limitPeriod: r.limitPeriod as LimitPeriod | null }];
    }),
  ) as RuleSet;
}

// ---------------------------------------------------------------- internos

function assertInTransaction(tx: Tx) {
  // El cliente normal tiene $connect; el cliente de una transacción no.
  if (typeof (tx as { $connect?: unknown }).$connect === "function") {
    throw new Error("Las operaciones de puntos deben ejecutarse dentro de db.$transaction");
  }
}

// FOR NO KEY UPDATE (y no FOR UPDATE): pone en fila las operaciones de puntos del
// mismo usuario, pero no choca con el candado KEY SHARE que Postgres toma al
// escribir una llave foránea hacia User (p. ej. Sale.claimedById o
// PointEntry.userId). Con FOR UPDATE, dos reclamos simultáneos del mismo cliente
// causaban un deadlock (40P01) en Neon.
async function lockUser(tx: Tx, userId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR NO KEY UPDATE`;
  if (rows.length === 0) throw new PointsError("USER_NOT_FOUND", "El usuario no existe");
}

async function insertEntry(
  tx: Tx,
  data: { userId: string; type: EntryType; points: number; sourceId: string; impact?: ImpactData; now: Date },
) {
  try {
    return await tx.pointEntry.create({
      data: {
        userId: data.userId,
        type: data.type,
        points: data.points,
        sourceId: data.sourceId,
        impact: data.impact as Prisma.InputJsonValue | undefined,
        createdAt: data.now,
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw new PointsError("ALREADY_CREDITED", "Esta evidencia ya se acreditó");
    }
    throw e;
  }
}

function limitRange(period: LimitPeriod | null, now: Date) {
  return period === "day" || period === "week" ? periodRange(period, now) : null;
}

// ---------------------------------------------------------------- acreditaciones

export type SaleLine = { qty: number; priceCents: number; ecoScore: EcoScore | null };

/** Compra del stand: renglones por Eco Score + bono del nivel actual. */
export async function creditPurchase(
  tx: Tx,
  input: { userId: string; saleId: string; items: SaleLine[]; now?: Date },
) {
  assertInTransaction(tx);
  const now = input.now ?? new Date();
  await lockUser(tx, input.userId);
  const rules = await loadRules(tx);
  const level = levelFor(await earnedInLevelWindow(tx, input.userId, now));
  const result = purchasePoints(input.items as PurchaseItem[], rules, level.purchaseBonusPct);
  const entry = await insertEntry(tx, {
    userId: input.userId,
    type: EntryType.PURCHASE,
    points: result.total,
    sourceId: input.saleId,
    now,
  });
  return { entry, ...result, level: level.name };
}

/**
 * "Trajo su bolsa o envase". Siempre se registra (cuenta como envase evitado),
 * pero solo paga si no se ha alcanzado el límite del periodo (1 por día).
 */
export async function creditBringContainer(tx: Tx, input: { userId: string; saleId: string; now?: Date }) {
  assertInTransaction(tx);
  const now = input.now ?? new Date();
  await lockUser(tx, input.userId);
  const rule = (await loadRules(tx)).BRING_CONTAINER;
  const range = limitRange(rule.limitPeriod, now);
  const used = range
    ? await tx.pointEntry.count({
        where: {
          userId: input.userId,
          type: EntryType.BRING_CONTAINER,
          points: { gt: 0 },
          createdAt: { gte: range.start, lt: range.end },
        },
      })
    : 0;
  const paid = applyLimit(1, used, rule.limitCount);
  const entry = await insertEntry(tx, {
    userId: input.userId,
    type: EntryType.BRING_CONTAINER,
    points: paid * rule.points,
    sourceId: input.saleId,
    impact: { containers: 1 },
    now,
  });
  return { entry, limitReached: paid === 0 };
}

/**
 * Reciclaje aprobado. Todas las piezas cuentan para el impacto; solo pagan las
 * que caben en el límite del periodo (20 por semana).
 */
export async function creditRecycle(
  tx: Tx,
  input: { userId: string; claimId: string; pieces: number; now?: Date },
) {
  assertInTransaction(tx);
  if (!Number.isInteger(input.pieces) || input.pieces <= 0) throw new Error("Número de piezas no válido");
  const now = input.now ?? new Date();
  await lockUser(tx, input.userId);
  const rule = (await loadRules(tx)).RECYCLE;
  const range = limitRange(rule.limitPeriod, now);
  let usedPieces = 0;
  if (range) {
    const rows = await tx.pointEntry.findMany({
      where: { userId: input.userId, type: EntryType.RECYCLE, createdAt: { gte: range.start, lt: range.end } },
      select: { impact: true },
    });
    usedPieces = rows.reduce((sum, r) => sum + ((r.impact as ImpactData | null)?.paidPieces ?? 0), 0);
  }
  const paidPieces = applyLimit(input.pieces, usedPieces, rule.limitCount);
  const entry = await insertEntry(tx, {
    userId: input.userId,
    type: EntryType.RECYCLE,
    points: paidPieces * rule.points,
    sourceId: input.claimId,
    impact: { pieces: input.pieces, paidPieces },
    now,
  });
  return { entry, paidPieces };
}

/**
 * Recibo aprobado. `prev` es el recibo APROBADO anterior del mismo servicio
 * (null si es el primero: solo línea base, 0 puntos, pero queda registrado).
 */
export async function creditBillReduction(
  tx: Tx,
  input: {
    userId: string;
    billId: string;
    kind: "ELECTRICITY" | "WATER";
    prev: BillReading | null;
    curr: BillReading;
    feSen: number;
    now?: Date;
  },
) {
  assertInTransaction(tx);
  const now = input.now ?? new Date();
  await lockUser(tx, input.userId);
  const rule = (await loadRules(tx)).BILL_REDUCTION;
  const result = billReduction(input.prev, input.curr, {
    pointsPer5Pct: rule.points,
    maxPerBill: rule.limitCount,
  });
  const entry = await insertEntry(tx, {
    userId: input.userId,
    type: EntryType.BILL_REDUCTION,
    points: result.points,
    sourceId: input.billId,
    impact: billImpact(input.kind, result.saved, input.feSen),
    now,
  });
  return { entry, ...result };
}

/**
 * Reto completado: paga `points` una sola vez por usuario y reto
 * (sourceId = "challengeId:userId", protegido por @@unique([type, sourceId])).
 */
export async function creditChallenge(
  tx: Tx,
  input: { userId: string; challengeId: string; points: number; now?: Date },
) {
  assertInTransaction(tx);
  if (!Number.isInteger(input.points) || input.points < 0) throw new Error("Puntos del reto no válidos");
  const now = input.now ?? new Date();
  await lockUser(tx, input.userId);
  return insertEntry(tx, {
    userId: input.userId,
    type: EntryType.CHALLENGE,
    points: input.points,
    sourceId: challengeSourceId(input.challengeId, input.userId),
    now,
  });
}

// ---------------------------------------------------------------- cargos

/** Canje o donación: crea un PointEntry negativo. Nunca deja saldo negativo. */
export async function debitPoints(
  tx: Tx,
  input: { userId: string; type: "REDEEM" | "DONATION"; sourceId: string; points: number; now?: Date },
) {
  assertInTransaction(tx);
  if (!Number.isInteger(input.points) || input.points <= 0) throw new Error("Cantidad de puntos no válida");
  const now = input.now ?? new Date();
  await lockUser(tx, input.userId);
  const balance = await balanceOf(tx, input.userId);
  if (balance < input.points) {
    throw new PointsError("INSUFFICIENT_BALANCE", "No tienes puntos suficientes");
  }
  const entry = await insertEntry(tx, {
    userId: input.userId,
    type: input.type,
    points: -input.points,
    sourceId: input.sourceId,
    now,
  });
  return { entry, balance: balance - input.points };
}
