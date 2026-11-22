import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPoints } from "@/lib/format";
import { CHALLENGE_METRICS, isChallengeMetric } from "@/lib/points/challenge-metrics";
import { challengesForUser } from "@/lib/points/challenges";

export const metadata: Metadata = { title: "Retos" };

const dayFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" });
const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

function amount(metric: string, value: number, target: number) {
  const unit = isChallengeMetric(metric) ? CHALLENGE_METRICS[metric].unit : "";
  if (unit === "%") return `${num.format(value)}% de ${num.format(target)}%`;
  return `${num.format(Math.min(value, target))} de ${num.format(target)} ${unit}`;
}

export default async function RetosPage() {
  const user = await requireUser();
  const challenges = await challengesForUser(db, user.id);
  const active = challenges.filter((c) => c.active && !c.completedAt);
  const badges = challenges.filter((c) => c.completedAt);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Retos</h1>
        <p className="text-sm text-muted-foreground">Llega a la meta antes de la fecha y ganas los puntos del reto.</p>
      </div>

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay retos activos por ahora.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {active.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{c.title}</p>
                    <span className="shrink-0 text-sm font-semibold text-primary">+{formatPoints(c.reward)}</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={c.progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Avance en ${c.title}`}
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${c.progressPct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{amount(c.metric, c.value, c.target)}</span>
                    <span>Hasta el {dayFmt.format(c.endsAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tus insignias</CardTitle>
        </CardHeader>
        <CardContent>
          {badges.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              Completa un reto para ganar tu primera insignia.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {badges.map((c) => (
                <li key={c.id} className="rounded-lg border bg-primary/5 p-3 text-center">
                  <p className="text-3xl" aria-hidden>
                    🏅
                  </p>
                  <p className="text-sm font-medium">{c.title}</p>
                  {c.completedAt && <p className="text-xs text-muted-foreground">{dayFmt.format(c.completedAt)}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
