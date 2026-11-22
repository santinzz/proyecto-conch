import type { Metadata } from "next";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AdminPageHeader } from "../admin-page";
import { EntityManager, type FieldDef } from "../entity-manager";

export const metadata: Metadata = { title: "Reglas" };

const LABELS: Record<string, { title: string; unit: string; limit: string }> = {
  PURCHASE_A: { title: "Compra, producto A", unit: "puntos por cada $10", limit: "" },
  PURCHASE_B: { title: "Compra, producto B", unit: "puntos por cada $10", limit: "" },
  PURCHASE_C: { title: "Compra, producto C", unit: "puntos por cada $10", limit: "" },
  BRING_CONTAINER: { title: "Trajo bolsa o envase", unit: "puntos", limit: "veces" },
  RECYCLE: { title: "Reciclaje", unit: "puntos por pieza", limit: "piezas" },
  BILL_REDUCTION: { title: "Reducción en recibo", unit: "puntos por cada 5%", limit: "puntos máximos" },
  CHALLENGE: { title: "Reto (valor por defecto)", unit: "puntos", limit: "" },
};
const PERIOD: Record<string, string> = { day: "por día", week: "por semana", bill: "por recibo" };

const FIELDS: FieldDef[] = [
  { name: "points", label: "Puntos", type: "number" },
  { name: "limitCount", label: "Límite", type: "number", nullable: true, help: "Vacío = sin límite" },
  {
    name: "limitPeriod",
    label: "Periodo del límite",
    type: "select",
    nullable: true,
    options: [
      { value: "day", label: "Por día" },
      { value: "week", label: "Por semana" },
      { value: "bill", label: "Por recibo" },
    ],
  },
];

export default async function ReglasPage() {
  await requireUser(AREA_ROLES.admin);
  const rules = await db.rule.findMany({ orderBy: { key: "asc" } });
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Reglas de puntos"
        description="Los cambios aplican a los movimientos nuevos; lo ya acreditado no cambia."
      />
      <EntityManager
        entity="rules"
        fields={FIELDS}
        canCreate={false}
        items={rules.map((r) => {
          const label = LABELS[r.key] ?? { title: r.key, unit: "puntos", limit: "" };
          const limit =
            r.limitCount === null ? "sin límite" : `máximo ${r.limitCount} ${label.limit} ${PERIOD[r.limitPeriod ?? ""] ?? ""}`;
          return {
            id: r.key,
            title: label.title,
            subtitle: `${r.points} ${label.unit} · ${limit.trim()}`,
            values: { points: r.points, limitCount: r.limitCount, limitPeriod: r.limitPeriod },
          };
        })}
      />
    </div>
  );
}
