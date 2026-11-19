import type { Metadata } from "next";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  await requireUser(AREA_ROLES.admin);
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Administración</h1>
      <p className="text-sm text-muted-foreground">
        Aquí estarán el catálogo, las reglas, los retos, las recompensas y las métricas.
      </p>
    </div>
  );
}
