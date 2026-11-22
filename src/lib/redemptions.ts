// Canjes (Fase 5). Canjear crea un PointEntry negativo con debitPoints (nunca deja
// saldo negativo), descuenta el stock y genera un cupón de un solo uso con QR que
// el operador marca como usado en la caja. Donar a "árboles plantados" funciona
// igual, pero queda registrado como usado (no hay nada que entregar).
// El cupón vale hasta el fin del piloto: no tiene fecha de vencimiento.
import { randomInt } from "node:crypto";
import { z } from "zod";
import { debitPoints, type Tx } from "@/lib/points/ledger";
import { normalizeCouponCode } from "@/lib/coupon-code";

export type RedemptionErrorCode =
  | "REWARD_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "NOT_FOUND"
  | "ALREADY_USED"
  | "NOT_A_COUPON"
  | "OWN_COUPON";

export const REDEMPTION_ERROR_MESSAGES: Record<RedemptionErrorCode, string> = {
  REWARD_NOT_FOUND: "Esa recompensa ya no está disponible",
  OUT_OF_STOCK: "Se agotó esta recompensa",
  NOT_FOUND: "No existe un cupón con ese código",
  ALREADY_USED: "Este cupón ya se usó",
  NOT_A_COUPON: "Ese código es de una donación, no de un cupón",
  OWN_COUPON: "No puedes marcar como usado tu propio cupón",
};

export const REDEMPTION_ERROR_STATUS: Record<RedemptionErrorCode, number> = {
  REWARD_NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  NOT_FOUND: 404,
  ALREADY_USED: 409,
  NOT_A_COUPON: 400,
  OWN_COUPON: 403,
};

export class RedemptionError extends Error {
  constructor(public readonly code: RedemptionErrorCode) {
    super(REDEMPTION_ERROR_MESSAGES[code]);
    this.name = "RedemptionError";
  }
}

export const redeemSchema = z.object({ rewardId: z.string().min(1).max(64) });

// Sin 0/O ni 1/I para que se pueda dictar sin confusiones.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** "ECO-7KQ2-MX4P": 32^8 combinaciones. */
export function newCouponCode(): string {
  return `ECO-${block()}-${block()}`;
}

/** Canjea una recompensa o dona puntos. Debe llamarse dentro de db.$transaction. */
export async function redeemReward(tx: Tx, input: { userId: string; rewardId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const reward = await tx.reward.findUnique({ where: { id: input.rewardId } });
  if (!reward) throw new RedemptionError("REWARD_NOT_FOUND");

  // Descuenta el stock solo si queda (a prueba de canjes simultáneos).
  const stock = await tx.reward.updateMany({
    where: { id: reward.id, stock: { gt: 0 } },
    data: { stock: { decrement: 1 } },
  });
  if (stock.count !== 1) throw new RedemptionError("OUT_OF_STOCK");

  let code = newCouponCode();
  while (await tx.redemption.findUnique({ where: { code }, select: { id: true } })) code = newCouponCode();

  const redemption = await tx.redemption.create({
    data: {
      userId: input.userId,
      rewardId: reward.id,
      code,
      usedAt: reward.isDonation ? now : null,
      createdAt: now,
    },
  });
  // Si no alcanza el saldo, lanza INSUFFICIENT_BALANCE y la transacción revierte stock y cupón.
  const debit = await debitPoints(tx, {
    userId: input.userId,
    type: reward.isDonation ? "DONATION" : "REDEEM",
    sourceId: redemption.id,
    points: reward.cost,
    now,
  });
  return { redemption, reward, balance: debit.balance };
}

/** Busca un cupón por su código (acepta el texto del QR o el código escrito a mano). */
export function findCoupon(client: Tx, rawCode: string) {
  const code = normalizeCouponCode(rawCode);
  if (!code) return Promise.resolve(null);
  return client.redemption.findUnique({
    where: { code },
    include: { reward: true, user: { select: { name: true } }, usedBy: { select: { name: true } } },
  });
}

/** El operador marca el cupón como usado en el stand. Debe llamarse dentro de db.$transaction. */
export async function markCouponUsed(tx: Tx, input: { operatorId: string; code: string; now?: Date }) {
  const now = input.now ?? new Date();
  const coupon = await findCoupon(tx, input.code);
  if (!coupon) throw new RedemptionError("NOT_FOUND");
  if (coupon.reward.isDonation) throw new RedemptionError("NOT_A_COUPON");
  if (coupon.userId === input.operatorId) throw new RedemptionError("OWN_COUPON");
  if (coupon.usedAt) throw new RedemptionError("ALREADY_USED");

  const updated = await tx.redemption.updateMany({
    where: { id: coupon.id, usedAt: null },
    data: { usedAt: now, usedById: input.operatorId },
  });
  if (updated.count !== 1) throw new RedemptionError("ALREADY_USED");
  return { code: coupon.code, reward: coupon.reward.name, customer: coupon.user.name };
}
