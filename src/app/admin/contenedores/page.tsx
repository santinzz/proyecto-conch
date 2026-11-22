import type { Metadata } from "next";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AdminPageHeader } from "../admin-page";
import { EntityManager, type FieldDef } from "../entity-manager";

export const metadata: Metadata = { title: "Contenedores" };

const FIELDS: FieldDef[] = [
  { name: "name", label: "Nombre", type: "text" },
  { name: "location", label: "Ubicación", type: "text" },
  { name: "code", label: "Código del QR", type: "text", help: "Letras, números y guiones; va dentro del QR del contenedor" },
];

export default async function ContenedoresPage() {
  await requireUser(AREA_ROLES.admin);
  const bins = await db.recycleBin.findMany({ orderBy: { code: "asc" } });
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Contenedores de reciclaje"
        description="El QR para imprimir de cada contenedor está en Operador → Validar reciclaje."
      />
      <EntityManager
        entity="bins"
        fields={FIELDS}
        canCreate
        createLabel="Agregar contenedor"
        items={bins.map((b) => ({
          id: b.id,
          title: b.name,
          subtitle: `${b.code} · ${b.location}`,
          values: { name: b.name, location: b.location, code: b.code },
        }))}
      />
    </div>
  );
}
