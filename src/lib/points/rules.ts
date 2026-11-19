// Claves de la tabla Rule. Los valores se ajustan desde la base de datos, no aquí.
export const RULE_KEYS = [
  "PURCHASE_A", // puntos por cada $10 del renglón, producto A
  "PURCHASE_B",
  "PURCHASE_C",
  "BRING_CONTAINER", // puntos por traer envase · limitCount = veces por periodo
  "RECYCLE", // puntos por pieza · limitCount = piezas por periodo
  "BILL_REDUCTION", // puntos por cada 5% completo · limitCount = tope por recibo
  "CHALLENGE", // valor por defecto de un reto
] as const;

export type RuleKey = (typeof RULE_KEYS)[number];

export type LimitPeriod = "day" | "week" | "bill";

export type RuleValue = {
  points: number;
  limitCount: number | null;
  limitPeriod: LimitPeriod | null;
};

export type RuleSet = Record<RuleKey, RuleValue>;
