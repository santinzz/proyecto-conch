import type { Metadata } from "next";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AdminPageHeader } from "../admin-page";
import { EntityManager, type FieldDef } from "../entity-manager";

export const metadata: Metadata = { title: "Recompensas" };

const FIELDS: FieldDef[] = [
  { name: "name", label: "Nombre", type: "text" },
  { name: "cost", label: "Costo en puntos", type: "number", help: "100 puntos ≈ $10 de referencia" },
  { name: "stock", label: "Disponibles", type: "number" },
  { name: "isDonation", label: "Es donación (no se entrega nada)", type: "boolean" },
];

export default async function RecompensasPage() {
  await requireUser(AREA_ROLES.admin);
  const [rewards, redeemed] = await Promise.all([
    db.reward.findMany({ orderBy: [{ isDonation: "asc" }, { cost: "asc" }] }),
    db.redemption.groupBy({ by: ["rewardId"], _count: { _all: true } }),
  ]);
  const count = (id: string) => redeemed.find((r) => r.rewardId === id)?._count._all ?? 0;

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Recompensas" description="El stock baja con cada canje." />
      <EntityManager
        entity="rewards"
        fields={FIELDS}
        canCreate
        createLabel="Agregar recompensa"
        items={rewards.map((r) => ({
          id: r.id,
          title: r.name,
          subtitle: `${r.cost} puntos · quedan ${r.stock} · ${count(r.id)} canjes${r.isDonation ? " · donación" : ""}`,
          values: { name: r.name, cost: r.cost, stock: r.stock, isDonation: r.isDonation },
        }))}
      />
    </div>
  );
}
