// Métricas de los retos (Challenge.metric). Funciones puras: sin base de datos.

export const CHALLENGE_METRICS = {
  BRING_CONTAINER_count: { label: "veces que traes tu envase", unit: "envases" },
  PURCHASE_count: { label: "compras en el stand", unit: "compras" },
  RECYCLE_pieces: { label: "piezas recicladas", unit: "piezas" },
  BILL_count: { label: "recibos aprobados", unit: "recibos" },
  ELECTRICITY_reduction_pct: { label: "reducción en tu recibo de luz", unit: "%" },
  WATER_reduction_pct: { label: "reducción en tu recibo de agua", unit: "%" },
} as const;

export type ChallengeMetric = keyof typeof CHALLENGE_METRICS;

export function isChallengeMetric(metric: string): metric is ChallengeMetric {
  return Object.hasOwn(CHALLENGE_METRICS, metric);
}

/** sourceId del PointEntry del reto: uno por usuario y reto. */
export function challengeSourceId(challengeId: string, userId: string): string {
  return `${challengeId}:${userId}`;
}

/** Avance de 0 a 100. */
export function progressPct(value: number, target: number): number {
  if (target <= 0) return 100;
  return Math.max(0, Math.min(100, Math.floor((value / target) * 100)));
}

/** ¿El reto está activo en `now`? (incluye el instante final). */
export function isActive(challenge: { startsAt: Date; endsAt: Date }, now: Date): boolean {
  return challenge.startsAt.getTime() <= now.getTime() && now.getTime() <= challenge.endsAt.getTime();
}
