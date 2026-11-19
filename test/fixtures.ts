import type { RuleSet } from "@/lib/points/rules";

/** Reglas con los valores iniciales de SPEC.md (los mismos del seed). */
export const SPEC_RULES: RuleSet = {
  PURCHASE_A: { points: 3, limitCount: null, limitPeriod: null },
  PURCHASE_B: { points: 2, limitCount: null, limitPeriod: null },
  PURCHASE_C: { points: 1, limitCount: null, limitPeriod: null },
  BRING_CONTAINER: { points: 10, limitCount: 1, limitPeriod: "day" },
  RECYCLE: { points: 5, limitCount: 20, limitPeriod: "week" },
  BILL_REDUCTION: { points: 50, limitCount: 200, limitPeriod: "bill" },
  CHALLENGE: { points: 100, limitCount: null, limitPeriod: null },
};
