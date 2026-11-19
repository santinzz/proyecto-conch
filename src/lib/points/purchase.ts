import type { EcoScore } from "./eco-score";
import type { RuleSet } from "./rules";

export type PurchaseItem = {
  qty: number;
  priceCents: number; // precio unitario
  ecoScore: EcoScore | null;
};

/** Cada cuántos centavos se dan puntos: $10 MXN. */
export const PURCHASE_STEP_CENTS = 1000;

const RULE_BY_SCORE = { A: "PURCHASE_A", B: "PURCHASE_B", C: "PURCHASE_C" } as const;

/** Puntos de un renglón: floor(subtotal / $10) × tasa de su Eco Score. */
export function linePoints(item: PurchaseItem, rules: RuleSet): number {
  if (!Number.isInteger(item.qty) || item.qty <= 0) throw new Error("Cantidad no válida");
  if (!Number.isInteger(item.priceCents) || item.priceCents < 0) throw new Error("Precio no válido");
  if (item.ecoScore === null) return 0;
  const rate = rules[RULE_BY_SCORE[item.ecoScore]].points;
  return Math.floor((item.qty * item.priceCents) / PURCHASE_STEP_CENTS) * rate;
}

/**
 * Puntos de una compra: suma de renglones y luego el bono del nivel
 * (+10% Brote, +20% Árbol) sobre el total, redondeado hacia abajo.
 */
export function purchasePoints(
  items: PurchaseItem[],
  rules: RuleSet,
  levelBonusPct: number,
): { base: number; bonus: number; total: number } {
  const base = items.reduce((sum, item) => sum + linePoints(item, rules), 0);
  const bonus = Math.floor((base * levelBonusPct) / 100);
  return { base, bonus, total: base + bonus };
}
