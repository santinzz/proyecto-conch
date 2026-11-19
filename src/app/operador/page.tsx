import type { Metadata } from "next";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Operador" };

export default async function OperadorPage() {
  await requireUser(AREA_ROLES.operador);
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Operador</h1>
      <p className="text-sm text-muted-foreground">
        Aquí estarán la caja, la validación de recibos y la de reciclaje.
      </p>
    </div>
  );
}
