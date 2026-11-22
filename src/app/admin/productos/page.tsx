import type { Metadata } from "next";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMXN } from "@/lib/format";
import { ecoScore } from "@/lib/points/eco-score";
import { AdminPageHeader } from "../admin-page";
import { EntityManager, type FieldDef } from "../entity-manager";

export const metadata: Metadata = { title: "Catálogo" };

const FIELDS: FieldDef[] = [
  { name: "name", label: "Nombre", type: "text" },
  { name: "priceCents", label: "Precio (MXN)", type: "money" },
  { name: "bulk", label: "A granel o retornable", type: "boolean" },
  { name: "local", label: "Local", type: "boolean" },
  { name: "plasticFree", label: "Sin plástico", type: "boolean" },
  { name: "certified", label: "Certificado", type: "boolean" },
  { name: "active", label: "Disponible en la caja", type: "boolean" },
];

export default async function ProductosPage() {
  await requireUser(AREA_ROLES.admin);
  const products = await db.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <div className="space-y-4">
      <AdminPageHeader title="Catálogo" description="El Eco Score se calcula solo con los criterios que marques." />
      <EntityManager
        entity="products"
        fields={FIELDS}
        canCreate
        createLabel="Agregar producto"
        items={products.map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: `${formatMXN(p.priceCents)} · Eco Score ${ecoScore(p) ?? "sin puntos"}${p.active ? "" : " · no disponible"}`,
          values: { ...p },
        }))}
      />
    </div>
  );
}
