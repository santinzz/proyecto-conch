import type { Metadata } from "next";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { CHALLENGE_METRICS, isChallengeMetric } from "@/lib/points/challenge-metrics";
import { AdminPageHeader } from "../admin-page";
import { EntityManager, type FieldDef } from "../entity-manager";

export const metadata: Metadata = { title: "Retos" };

const FIELDS: FieldDef[] = [
  { name: "title", label: "Título", type: "text" },
  {
    name: "metric",
    label: "Qué se mide",
    type: "select",
    options: Object.entries(CHALLENGE_METRICS).map(([value, m]) => ({ value, label: `${m.label} (${m.unit})` })),
  },
  { name: "target", label: "Meta", type: "number", help: "En la unidad de lo que se mide (p. ej. 10 para 10%)" },
  { name: "reward", label: "Puntos al completarlo", type: "number" },
  { name: "startsAt", label: "Empieza", type: "datetime" },
  { name: "endsAt", label: "Termina", type: "datetime" },
];

const day = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });

export default async function RetosAdminPage() {
  await requireUser(AREA_ROLES.admin);
  const [challenges, completed] = await Promise.all([
    db.challenge.findMany({ orderBy: { startsAt: "desc" } }),
    db.pointEntry.findMany({ where: { type: "CHALLENGE" }, select: { sourceId: true } }),
  ]);
  const doneBy = (id: string) => completed.filter((c) => c.sourceId?.startsWith(`${id}:`)).length;

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Retos" description="Se pagan solos cuando alguien llega a la meta dentro de las fechas." />
      <EntityManager
        entity="challenges"
        fields={FIELDS}
        canCreate
        createLabel="Agregar reto"
        items={challenges.map((c) => ({
          id: c.id,
          title: c.title,
          subtitle: `Meta ${c.target} ${isChallengeMetric(c.metric) ? CHALLENGE_METRICS[c.metric].unit : c.metric} · +${c.reward} · ${day.format(c.startsAt)} – ${day.format(c.endsAt)} · ${doneBy(c.id)} lo completaron`,
          values: {
            title: c.title,
            metric: c.metric,
            target: c.target,
            reward: c.reward,
            startsAt: c.startsAt.toISOString(),
            endsAt: c.endsAt.toISOString(),
          },
        }))}
      />
    </div>
  );
}
