export type EcoScore = "A" | "B" | "C";

export type EcoCriteria = {
  bulk: boolean; // granel o retornable
  local: boolean;
  plasticFree: boolean;
  certified: boolean;
};

/**
 * Eco Score: cuenta cuántos criterios cumple el producto.
 * 3 o 4 = A, 2 = B, 1 = C, 0 = sin puntos (null).
 */
export function ecoScore(product: EcoCriteria): EcoScore | null {
  const count = [product.bulk, product.local, product.plasticFree, product.certified].filter(Boolean).length;
  if (count >= 3) return "A";
  if (count === 2) return "B";
  if (count === 1) return "C";
  return null;
}
