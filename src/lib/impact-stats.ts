// Impacto y métricas del piloto (Fase 6): Mi impacto, la página pública, el panel
// del admin y la exportación CSV para el reporte.
import { createHmac } from "node:crypto";
import { EntryType } from "@/generated/prisma/client";
import { type CsvValue, toCsv } from "@/lib/csv";
import type { ImpactData } from "@/lib/points/impact";
import { summarizeImpact } from "@/lib/points/impact-summary";
import { ENTRY_LABELS } from "@/lib/points/labels";
import type { Tx } from "@/lib/points/ledger";
import { PILOT_TIME_ZONE, periodRange } from "@/lib/points/limits";

/** Movimientos que llevan impacto ambiental en PointEntry.impact. */
const IMPACT_TYPES = [EntryType.BILL_REDUCTION, EntryType.BRING_CONTAINER, EntryType.RECYCLE];
/** Semanas que muestran las gráficas. */
export const IMPACT_WEEKS = 8;

export async function userImpact(client: Tx, userId: string, now = new Date()) {
  const entries = await client.pointEntry.findMany({
    where: { userId, type: { in: IMPACT_TYPES } },
    select: { impact: true, createdAt: true },
  });
  return summarizeImpact(entries, { now, weeks: IMPACT_WEEKS });
}

/** Totales del piloto sin datos personales (página pública). */
export async function pilotImpact(client: Tx, now = new Date()) {
  const [entries, participants, activeThisWeek] = await Promise.all([
    client.pointEntry.findMany({ where: { type: { in: IMPACT_TYPES } }, select: { impact: true, createdAt: true } }),
    client.pointEntry.findMany({ distinct: ["userId"], select: { userId: true } }),
    client.pointEntry.findMany({
      where: { createdAt: { gte: periodRange("week", now).start } },
      distinct: ["userId"],
      select: { userId: true },
    }),
  ]);
  return {
    ...summarizeImpact(entries, { now, weeks: IMPACT_WEEKS }),
    participants: participants.length,
    activeThisWeek: activeThisWeek.length,
  };
}

/** Panel del admin. */
export async function adminMetrics(client: Tx, now = new Date()) {
  const [roles, earned, spent, sales, pendingBills, pendingRecycle, coupons, couponsUsed, donations, pilot] =
    await Promise.all([
      client.user.groupBy({ by: ["role"], _count: { _all: true } }),
      client.pointEntry.aggregate({ where: { points: { gt: 0 } }, _sum: { points: true } }),
      client.pointEntry.aggregate({ where: { points: { lt: 0 } }, _sum: { points: true } }),
      client.sale.aggregate({ where: { claimedAt: { not: null } }, _count: { _all: true }, _sum: { totalCents: true } }),
      client.bill.count({ where: { status: "PENDING" } }),
      client.recycleClaim.count({ where: { status: "PENDING" } }),
      client.redemption.count({ where: { reward: { isDonation: false } } }),
      client.redemption.count({ where: { reward: { isDonation: false }, usedAt: { not: null } } }),
      client.redemption.count({ where: { reward: { isDonation: true } } }),
      pilotImpact(client, now),
    ]);
  const count = (role: string) => roles.find((r) => r.role === role)?._count._all ?? 0;
  return {
    users: { customers: count("CUSTOMER"), operators: count("OPERATOR"), admins: count("ADMIN") },
    participants: pilot.participants,
    activeThisWeek: pilot.activeThisWeek,
    pointsEarned: earned._sum.points ?? 0,
    pointsSpent: -(spent._sum.points ?? 0),
    sales: { count: sales._count._all, totalCents: sales._sum.totalCents ?? 0 },
    pending: { bills: pendingBills, recycle: pendingRecycle },
    coupons: { issued: coupons, used: couponsUsed },
    trees: donations,
    impact: pilot.totals,
    weekly: pilot.weekly,
  };
}

// ---------------------------------------------------------------- CSV

/**
 * Seudónimo estable por persona: el reporte no necesita nombres ni correos.
 * Con HMAC (y AUTH_SECRET) no se puede regresar del seudónimo al id.
 */
export function pseudonym(userId: string, secret = process.env.AUTH_SECRET ?? ""): string {
  return `U-${createHmac("sha256", secret).update(userId).digest("hex").slice(0, 8)}`;
}

const stamp = new Intl.DateTimeFormat("sv-SE", {
  timeZone: PILOT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const day = new Intl.DateTimeFormat("sv-SE", { timeZone: PILOT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Todos los movimientos del piloto, uno por renglón. */
export async function movementsCsv(client: Tx): Promise<string> {
  const entries = await client.pointEntry.findMany({
    orderBy: { createdAt: "asc" },
    select: { userId: true, type: true, points: true, impact: true, createdAt: true },
  });
  const rows: CsvValue[][] = entries.map((e) => {
    const impact = (e.impact ?? {}) as ImpactData;
    return [
      stamp.format(e.createdAt),
      pseudonym(e.userId),
      ENTRY_LABELS[e.type].label,
      e.points,
      impact.kwh ?? null,
      impact.m3 === undefined ? null : Math.round(impact.m3 * 1000 * 10) / 10,
      impact.co2Kg ?? null,
      impact.containers ?? null,
      impact.pieces ?? null,
    ];
  });
  return toCsv(
    ["fecha (CDMX)", "participante", "movimiento", "puntos", "kWh ahorrados", "litros ahorrados", "kg CO2 evitados", "envases", "piezas recicladas"],
    rows,
  );
}

/** Impacto por semana desde el primer movimiento (para las gráficas del reporte). */
export async function weeklyCsv(client: Tx, now = new Date()): Promise<string> {
  const entries = await client.pointEntry.findMany({ select: { userId: true, type: true, points: true, impact: true, createdAt: true } });
  const first = entries.reduce((min, e) => Math.min(min, e.createdAt.getTime()), now.getTime());
  // Semanas desde la del primer movimiento hasta la actual (México ya no cambia de horario).
  const span = periodRange("week", now).start.getTime() - periodRange("week", new Date(first)).start.getTime();
  const weeks = Math.min(52, Math.round(span / (7 * 24 * 60 * 60 * 1000)) + 1);
  const impactEntries = entries.filter((e) => (IMPACT_TYPES as string[]).includes(e.type));
  const { weekly } = summarizeImpact(impactEntries, { now, weeks });

  const rows: CsvValue[][] = weekly.map((w, i) => {
    const start = w.weekStart.getTime();
    const end = i + 1 < weekly.length ? weekly[i + 1].weekStart.getTime() : periodRange("week", now).end.getTime();
    const inWeek = entries.filter((e) => e.createdAt.getTime() >= start && e.createdAt.getTime() < end);
    return [
      day.format(w.weekStart),
      w.kwh,
      w.liters,
      w.co2Kg,
      w.containers,
      w.pieces,
      inWeek.reduce((sum, e) => sum + Math.max(0, e.points), 0),
      new Set(inWeek.map((e) => e.userId)).size,
    ];
  });
  return toCsv(
    ["semana (lunes)", "kWh ahorrados", "litros ahorrados", "kg CO2 evitados", "envases", "piezas recicladas", "puntos ganados", "personas activas"],
    rows,
  );
}
