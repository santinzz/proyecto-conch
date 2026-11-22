// Ventas del stand: el operador arma la venta y genera un QR firmado; el cliente
// lo escanea y se le acreditan los puntos UNA sola vez.
import { z } from "zod";
import { ecoScore, type EcoScore } from "@/lib/points/eco-score";
import { evaluateChallenges } from "@/lib/points/challenges";
import { creditBringContainer, creditPurchase, loadRules, type Tx } from "@/lib/points/ledger";
import { purchasePoints } from "@/lib/points/purchase";
import { newNonce, QR_TTL_SECONDS, signTicket, verifyTicket } from "@/lib/qr";

export const createSaleSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1).max(64), qty: z.int().min(1).max(99) }))
    .max(50),
  broughtContainer: z.boolean().default(false),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const claimSaleSchema = z.object({ token: z.string().min(10).max(500) });

export type SaleErrorCode =
  | "EMPTY_SALE"
  | "PRODUCT_NOT_FOUND"
  | "INVALID_TICKET"
  | "EXPIRED"
  | "ALREADY_CLAIMED"
  | "OWN_SALE";

export const SALE_ERROR_MESSAGES: Record<SaleErrorCode, string> = {
  EMPTY_SALE: "Agrega al menos un producto o marca que trajo su envase",
  PRODUCT_NOT_FOUND: "Algún producto ya no está disponible",
  INVALID_TICKET: "QR inválido",
  EXPIRED: "QR vencido: pide al cajero que genere uno nuevo",
  ALREADY_CLAIMED: "Este ticket ya se canjeó",
  OWN_SALE: "No puedes canjear una venta que tú registraste",
};

export class SaleError extends Error {
  constructor(public readonly code: SaleErrorCode) {
    super(SALE_ERROR_MESSAGES[code]);
    this.name = "SaleError";
  }
}

/** Renglón guardado en Sale.items. */
const saleLineSchema = z.object({
  productId: z.string(),
  name: z.string(),
  qty: z.int(),
  priceCents: z.int(),
  ecoScore: z.enum(["A", "B", "C"]).nullable(),
});
export type SaleLine = z.infer<typeof saleLineSchema>;

/**
 * Crea la venta con precios y Eco Score tomados de la base de datos (nunca del
 * celular del operador) y devuelve el token firmado para el QR.
 */
export async function createSale(
  client: Tx,
  input: CreateSaleInput & { operatorId: string; secret: string; now?: Date },
) {
  const now = input.now ?? new Date();

  // Junta renglones repetidos del mismo producto.
  const qtyById = new Map<string, number>();
  for (const item of input.items) qtyById.set(item.productId, (qtyById.get(item.productId) ?? 0) + item.qty);
  if (qtyById.size === 0 && !input.broughtContainer) throw new SaleError("EMPTY_SALE");

  const products = await client.product.findMany({ where: { id: { in: [...qtyById.keys()] }, active: true } });
  if (products.length !== qtyById.size) throw new SaleError("PRODUCT_NOT_FOUND");

  const lines: SaleLine[] = products.map((p) => ({
    productId: p.id,
    name: p.name,
    qty: qtyById.get(p.id)!,
    priceCents: p.priceCents,
    ecoScore: ecoScore(p),
  }));
  const totalCents = lines.reduce((sum, l) => sum + l.qty * l.priceCents, 0);
  // Puntos base (sin bono): el bono depende del nivel de quien reclame el ticket.
  const basePoints = purchasePoints(lines, await loadRules(client), 0).base;

  const sale = await client.sale.create({
    data: {
      operatorId: input.operatorId,
      items: lines,
      totalCents,
      points: basePoints,
      broughtContainer: input.broughtContainer,
      qrNonce: newNonce(),
      expiresAt: new Date(now.getTime() + QR_TTL_SECONDS * 1000),
      createdAt: now,
    },
  });
  const token = signTicket({ saleId: sale.id, nonce: sale.qrNonce, expiresAt: sale.expiresAt }, input.secret);
  return { sale, lines, token };
}

/**
 * Reclama el ticket. Debe llamarse dentro de db.$transaction: marca la venta y
 * crea los PointEntry juntos, o no hace nada.
 */
export async function claimSale(tx: Tx, input: { userId: string; token: string; secret: string; now?: Date }) {
  const now = input.now ?? new Date();
  const verified = verifyTicket(input.token, input.secret, now);
  if (!verified.ok) throw new SaleError(verified.reason === "EXPIRED" ? "EXPIRED" : "INVALID_TICKET");

  const sale = await tx.sale.findUnique({ where: { id: verified.saleId } });
  if (!sale || sale.qrNonce !== verified.nonce) throw new SaleError("INVALID_TICKET");
  if (sale.expiresAt.getTime() <= now.getTime()) throw new SaleError("EXPIRED");
  if (sale.operatorId === input.userId) throw new SaleError("OWN_SALE");
  if (sale.claimedById) throw new SaleError("ALREADY_CLAIMED");

  // Marca la venta solo si nadie la ha reclamado (a prueba de dos escaneos simultáneos).
  const marked = await tx.sale.updateMany({
    where: { id: sale.id, qrNonce: verified.nonce, claimedById: null },
    data: { claimedById: input.userId, claimedAt: now },
  });
  if (marked.count !== 1) throw new SaleError("ALREADY_CLAIMED");

  const lines = z.array(saleLineSchema).parse(sale.items);
  const purchase = lines.length
    ? await creditPurchase(tx, {
        userId: input.userId,
        saleId: sale.id,
        items: lines.map((l) => ({ qty: l.qty, priceCents: l.priceCents, ecoScore: l.ecoScore as EcoScore | null })),
        now,
      })
    : null;
  const container = sale.broughtContainer
    ? await creditBringContainer(tx, { userId: input.userId, saleId: sale.id, now })
    : null;

  const challenges = await evaluateChallenges(tx, { userId: input.userId, now });

  const purchasePts = purchase?.total ?? 0;
  const containerPts = container?.entry.points ?? 0;
  return {
    saleId: sale.id,
    totalCents: sale.totalCents,
    purchasePoints: purchasePts,
    levelBonus: purchase?.bonus ?? 0,
    containerPoints: containerPts,
    containerLimitReached: container?.limitReached ?? false,
    totalPoints: purchasePts + containerPts,
    challenges: challenges.map((c) => ({ title: c.title, reward: c.reward })),
  };
}
