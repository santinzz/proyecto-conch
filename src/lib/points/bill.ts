export type BillReading = {
  periodStart: Date;
  periodEnd: Date;
  consumption: number; // kWh o m³
};

export type BillReductionRule = {
  pointsPer5Pct: number; // Rule BILL_REDUCTION.points
  maxPerBill: number | null; // Rule BILL_REDUCTION.limitCount
};

export type BillReductionResult = {
  baseline: boolean; // primer recibo del servicio: solo línea base
  reductionPct: number; // positivo = bajó el consumo; 2 decimales
  points: number;
  saved: number; // kWh o m³ ahorrados (0 si no hubo reducción)
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días del periodo (periodEnd − periodStart). */
export function periodDays(bill: Pick<BillReading, "periodStart" | "periodEnd">): number {
  const days = Math.round((bill.periodEnd.getTime() - bill.periodStart.getTime()) / DAY_MS);
  if (days <= 0) throw new Error("El periodo del recibo no es válido");
  return days;
}

export function dailyAverage(bill: BillReading): number {
  if (!(bill.consumption >= 0)) throw new Error("El consumo no es válido");
  return bill.consumption / periodDays(bill);
}

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

/**
 * Puntos por reducción de consumo contra el recibo aprobado anterior del mismo
 * servicio. Se compara el consumo diario promedio para que periodos de distinta
 * duración sean justos.
 *
 *   reductionPct = (prevDaily − currDaily) / prevDaily × 100
 *   points       = min(tope, floor(reductionPct / 5) × 50)   (0 si reductionPct ≤ 0)
 *   saved        = (prevDaily − currDaily) × días del periodo actual
 *
 * El porcentaje se redondea a 2 decimales antes del floor para que un 5% exacto
 * no se convierta en 4.9999…% por errores de punto flotante.
 */
export function billReduction(
  prev: BillReading | null,
  curr: BillReading,
  rule: BillReductionRule,
): BillReductionResult {
  const currDaily = dailyAverage(curr);
  if (!prev) return { baseline: true, reductionPct: 0, points: 0, saved: 0 };

  const prevDaily = dailyAverage(prev);
  if (prevDaily === 0) return { baseline: false, reductionPct: 0, points: 0, saved: 0 };

  const reductionPct = round(((prevDaily - currDaily) / prevDaily) * 100, 2);
  if (reductionPct <= 0) return { baseline: false, reductionPct, points: 0, saved: 0 };

  const raw = Math.floor(reductionPct / 5) * rule.pointsPer5Pct;
  const points = rule.maxPerBill === null ? raw : Math.min(rule.maxPerBill, raw);
  const saved = round((prevDaily - currDaily) * periodDays(curr), 3);
  return { baseline: false, reductionPct, points, saved };
}

/** Diferencia máxima permitida entre lo confirmado y lo leído por OCR. */
export const OCR_TOLERANCE = 0.1;
/** Reducción a partir de la cual se revisa con lupa. */
export const SUSPICIOUS_REDUCTION_PCT = 50;

/**
 * ¿El operador debe revisar este recibo con detalle?
 * Sí si el OCR no leyó nada, si lo confirmado difiere más de 10% de lo leído,
 * o si la reducción supera 50%.
 */
export function needsDetailedReview(input: {
  confirmed: number;
  ocr: number | null;
  reductionPct: number;
}): boolean {
  if (input.reductionPct > SUSPICIOUS_REDUCTION_PCT) return true;
  if (input.ocr === null || input.ocr <= 0) return true;
  return Math.abs(input.confirmed - input.ocr) / input.ocr > OCR_TOLERANCE;
}
