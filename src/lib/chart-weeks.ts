import type { ChartWeek } from "@/components/impact-chart";
import type { ImpactWeek } from "@/lib/points/impact-summary";
import { PILOT_TIME_ZONE } from "@/lib/points/limits";

const weekLabel = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: PILOT_TIME_ZONE });

/** Semanas listas para la gráfica (etiqueta = lunes de la semana). */
export function toChartWeeks(weekly: ImpactWeek[]): ChartWeek[] {
  return weekly.map((w) => ({
    label: weekLabel.format(w.weekStart),
    co2Kg: w.co2Kg,
    liters: w.liters,
    containers: w.containers,
    pieces: w.pieces,
  }));
}
