// Reciclaje en campus (Fase 5). El QR del contenedor es fijo, así que no paga por
// sí solo: crea una solicitud con el número de piezas y el operador la confirma
// (puede corregir las piezas). Al aprobar se acredita con creditRecycle, que
// respeta el límite semanal, y se revisan los retos.
import { z } from "zod";
import { evaluateChallenges } from "@/lib/points/challenges";
import { creditRecycle, type Tx } from "@/lib/points/ledger";

/** Piezas por solicitud y solicitudes pendientes por persona (evita spam). */
export const MAX_PIECES_PER_CLAIM = 100;
export const MAX_PENDING_CLAIMS = 3;

export type RecycleErrorCode =
  | "BIN_NOT_FOUND"
  | "INVALID_PIECES"
  | "TOO_MANY_PENDING"
  | "NOT_FOUND"
  | "NOT_PENDING"
  | "OWN_CLAIM";

export const RECYCLE_ERROR_MESSAGES: Record<RecycleErrorCode, string> = {
  BIN_NOT_FOUND: "Ese contenedor no existe",
  INVALID_PIECES: `Indica de 1 a ${MAX_PIECES_PER_CLAIM} piezas`,
  TOO_MANY_PENDING: "Ya tienes solicitudes esperando: espera a que el equipo las revise",
  NOT_FOUND: "Solicitud no encontrada",
  NOT_PENDING: "Esta solicitud ya se revisó",
  OWN_CLAIM: "No puedes confirmar tu propio reciclaje",
};

export const RECYCLE_ERROR_STATUS: Record<RecycleErrorCode, number> = {
  BIN_NOT_FOUND: 404,
  INVALID_PIECES: 400,
  TOO_MANY_PENDING: 429,
  NOT_FOUND: 404,
  NOT_PENDING: 409,
  OWN_CLAIM: 403,
};

export class RecycleError extends Error {
  constructor(public readonly code: RecycleErrorCode) {
    super(RECYCLE_ERROR_MESSAGES[code]);
    this.name = "RecycleError";
  }
}

const piecesSchema = z.int().min(1).max(MAX_PIECES_PER_CLAIM);

export const recycleClaimSchema = z.object({ binCode: z.string().trim().min(1).max(40), pieces: piecesSchema });
export const recycleReviewSchema = z.object({ action: z.enum(["approve", "reject"]), pieces: piecesSchema.optional() });

const validPieces = (n: number) => piecesSchema.safeParse(n).success;

/** El cliente registra las piezas que dejó en el contenedor. */
export async function createRecycleClaim(
  client: Tx,
  input: { userId: string; binCode: string; pieces: number; now?: Date },
) {
  if (!validPieces(input.pieces)) throw new RecycleError("INVALID_PIECES");
  const bin = await client.recycleBin.findUnique({ where: { code: input.binCode } });
  if (!bin) throw new RecycleError("BIN_NOT_FOUND");
  const pending = await client.recycleClaim.count({ where: { userId: input.userId, status: "PENDING" } });
  if (pending >= MAX_PENDING_CLAIMS) throw new RecycleError("TOO_MANY_PENDING");
  return client.recycleClaim.create({
    data: { userId: input.userId, binId: bin.id, pieces: input.pieces, createdAt: input.now ?? new Date() },
  });
}

/**
 * El operador aprueba (con las piezas que contó) o rechaza.
 * Debe llamarse dentro de db.$transaction.
 */
export async function reviewRecycleClaim(
  tx: Tx,
  input: { reviewerId: string; claimId: string; action: "approve" | "reject"; pieces?: number; now?: Date },
) {
  const now = input.now ?? new Date();
  const claim = await tx.recycleClaim.findUnique({ where: { id: input.claimId } });
  if (!claim) throw new RecycleError("NOT_FOUND");
  if (claim.userId === input.reviewerId) throw new RecycleError("OWN_CLAIM");
  if (claim.status !== "PENDING") throw new RecycleError("NOT_PENDING");

  if (input.action === "reject") {
    const updated = await tx.recycleClaim.updateMany({
      where: { id: claim.id, status: "PENDING" },
      data: { status: "REJECTED", reviewedById: input.reviewerId, reviewedAt: now },
    });
    if (updated.count !== 1) throw new RecycleError("NOT_PENDING");
    return { status: "REJECTED" as const };
  }

  const pieces = input.pieces ?? claim.pieces;
  if (!validPieces(pieces)) throw new RecycleError("INVALID_PIECES");
  const updated = await tx.recycleClaim.updateMany({
    where: { id: claim.id, status: "PENDING" },
    data: { status: "APPROVED", confirmedPieces: pieces, reviewedById: input.reviewerId, reviewedAt: now },
  });
  if (updated.count !== 1) throw new RecycleError("NOT_PENDING");

  const credit = await creditRecycle(tx, { userId: claim.userId, claimId: claim.id, pieces, now });
  const challenges = await evaluateChallenges(tx, { userId: claim.userId, now });
  return {
    status: "APPROVED" as const,
    pieces,
    paidPieces: credit.paidPieces,
    points: credit.entry.points,
    challenges: challenges.map((c) => ({ title: c.title, reward: c.reward })),
  };
}
