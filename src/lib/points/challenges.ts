// Retos (SPEC.md, "API"): se evalúan después de cada movimiento acreditado. Si el
// usuario llega a la meta dentro de las fechas del reto, se paga UNA vez con
// creditChallenge (sourceId = "challengeId:userId").
//
// Métricas: ver challenge-metrics.ts. Solo cuenta lo que pasó dentro de
// [startsAt, endsAt]; las reducciones de recibo cuentan por la fecha de aprobación.
import { EntryType } from "@/generated/prisma/client";
import { type ChallengeMetric, challengeSourceId, isActive, isChallengeMetric, progressPct } from "./challenge-metrics";
import type { ImpactData } from "./impact";
import { creditChallenge, type Tx } from "./ledger";

type ChallengeRow = { id: string; title: string; metric: string; target: number; reward: number; startsAt: Date; endsAt: Date };

/** Valor actual de la métrica del usuario dentro de las fechas del reto. */
export async function metricValue(client: Tx, userId: string, challenge: ChallengeRow, now: Date): Promise<number> {
  if (!isChallengeMetric(challenge.metric)) return 0;
  const end = new Date(Math.min(now.getTime(), challenge.endsAt.getTime()));
  const createdAt = { gte: challenge.startsAt, lte: end };
  const metric: ChallengeMetric = challenge.metric;

  switch (metric) {
    case "BRING_CONTAINER_count":
      return client.pointEntry.count({ where: { userId, type: EntryType.BRING_CONTAINER, createdAt } });
    case "PURCHASE_count":
      return client.pointEntry.count({ where: { userId, type: EntryType.PURCHASE, createdAt } });
    case "BILL_count":
      return client.pointEntry.count({ where: { userId, type: EntryType.BILL_REDUCTION, createdAt } });
    case "RECYCLE_pieces": {
      const rows = await client.pointEntry.findMany({
        where: { userId, type: EntryType.RECYCLE, createdAt },
        select: { impact: true },
      });
      return rows.reduce((sum, r) => sum + ((r.impact as ImpactData | null)?.pieces ?? 0), 0);
    }
    case "ELECTRICITY_reduction_pct":
    case "WATER_reduction_pct": {
      const result = await client.bill.aggregate({
        where: {
          userId,
          kind: metric === "ELECTRICITY_reduction_pct" ? "ELECTRICITY" : "WATER",
          status: "APPROVED",
          reviewedAt: createdAt,
        },
        _max: { reductionPct: true },
      });
      return Math.max(0, result._max.reductionPct ?? 0);
    }
  }
}

/**
 * Revisa los retos activos que el usuario aún no completa y paga los que ya
 * alcanzó. Debe llamarse dentro de la misma transacción que acreditó el movimiento.
 */
export async function evaluateChallenges(tx: Tx, input: { userId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const active = await tx.challenge.findMany({ where: { startsAt: { lte: now }, endsAt: { gte: now } } });
  if (active.length === 0) return [];

  const paid = await tx.pointEntry.findMany({
    where: {
      userId: input.userId,
      type: EntryType.CHALLENGE,
      sourceId: { in: active.map((c) => challengeSourceId(c.id, input.userId)) },
    },
    select: { sourceId: true },
  });
  const done = new Set(paid.map((p) => p.sourceId));

  const completed: { id: string; title: string; reward: number }[] = [];
  for (const challenge of active) {
    if (done.has(challengeSourceId(challenge.id, input.userId))) continue;
    const value = await metricValue(tx, input.userId, challenge, now);
    if (value >= challenge.target) {
      await creditChallenge(tx, { userId: input.userId, challengeId: challenge.id, points: challenge.reward, now });
      completed.push({ id: challenge.id, title: challenge.title, reward: challenge.reward });
    }
  }
  return completed;
}

/** Retos para la pantalla del cliente: activos con su avance y los completados (insignias). */
export async function challengesForUser(client: Tx, userId: string, now = new Date()) {
  const [challenges, entries] = await Promise.all([
    client.challenge.findMany({ orderBy: { endsAt: "asc" } }),
    client.pointEntry.findMany({
      where: { userId, type: EntryType.CHALLENGE },
      select: { sourceId: true, createdAt: true },
    }),
  ]);
  const completedAt = new Map(entries.map((e) => [e.sourceId, e.createdAt]));

  return Promise.all(
    challenges.map(async (c) => {
      const doneAt = completedAt.get(challengeSourceId(c.id, userId)) ?? null;
      const active = isActive(c, now);
      const value = doneAt || active ? await metricValue(client, userId, c, now) : 0;
      return {
        id: c.id,
        title: c.title,
        metric: c.metric,
        target: c.target,
        reward: c.reward,
        endsAt: c.endsAt,
        active,
        value,
        progressPct: doneAt ? 100 : progressPct(value, c.target),
        completedAt: doneAt,
      };
    }),
  );
}
