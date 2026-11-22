// Totales de impacto y serie por semana a partir de PointEntry.impact (SPEC.md, "Impacto"):
//   co2Kg = kWh ahorrados × FE_SEN (se guarda al aprobar el recibo)
//   litros = m³ ahorrados × 1000 · envases = BRING_CONTAINER · piezas = reciclaje aprobado
// Funciones puras: la consulta a la base vive en src/lib/impact-stats.ts.
import type { ImpactData } from "./impact";
import { periodRange } from "./limits";

export type ImpactTotals = { kwh: number; liters: number; co2Kg: number; containers: number; pieces: number };
export type ImpactWeek = ImpactTotals & { weekStart: Date };
export type ImpactEntry = { impact: unknown; createdAt: Date };

export const emptyTotals = (): ImpactTotals => ({ kwh: 0, liters: 0, co2Kg: 0, containers: 0, pieces: 0 });

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function add(totals: ImpactTotals, raw: unknown) {
  const impact = (raw ?? {}) as ImpactData;
  totals.kwh += num(impact.kwh);
  totals.liters += num(impact.m3) * 1000;
  totals.co2Kg += num(impact.co2Kg);
  totals.containers += num(impact.containers);
  totals.pieces += num(impact.pieces);
}

function rounded(t: ImpactTotals): ImpactTotals {
  return {
    kwh: round(t.kwh, 2),
    liters: round(t.liters, 1),
    co2Kg: round(t.co2Kg, 2),
    containers: t.containers,
    pieces: t.pieces,
  };
}

/** Inicio (lunes 00:00, hora de CDMX) de las últimas `weeks` semanas, de la más vieja a la actual. */
export function weekStarts(now: Date, weeks: number): Date[] {
  const starts = [periodRange("week", now).start];
  while (starts.length < weeks) starts.unshift(periodRange("week", new Date(starts[0].getTime() - 1)).start);
  return starts;
}

/** Totales de todo el periodo y desglose de las últimas `weeks` semanas. */
export function summarizeImpact(entries: ImpactEntry[], options: { now: Date; weeks: number }) {
  const totals = emptyTotals();
  const starts = weekStarts(options.now, options.weeks);
  const weekly = starts.map(() => emptyTotals());
  const end = periodRange("week", options.now).end.getTime();

  for (const e of entries) {
    add(totals, e.impact);
    const t = e.createdAt.getTime();
    if (t < starts[0].getTime() || t >= end) continue;
    let i = starts.length - 1;
    while (i > 0 && t < starts[i].getTime()) i--;
    add(weekly[i], e.impact);
  }
  return {
    totals: rounded(totals),
    weekly: weekly.map((w, i): ImpactWeek => ({ weekStart: starts[i], ...rounded(w) })),
  };
}
