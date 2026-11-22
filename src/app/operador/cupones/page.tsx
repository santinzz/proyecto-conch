import type { Metadata } from "next";
import Link from "next/link";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { CouponDesk } from "./coupon-desk";

export const metadata: Metadata = { title: "Cupones" };

export default async function CuponesPage() {
  await requireUser(AREA_ROLES.operador);
  return (
    <div className="space-y-4">
      <Link href="/operador" className="text-sm text-muted-foreground hover:underline">
        ← Operador
      </Link>
      <h1 className="text-xl font-semibold">Cupones</h1>
      <p className="text-sm text-muted-foreground">Escanea o escribe el cupón del cliente, entrega la recompensa y márcalo como usado.</p>
      <CouponDesk />
    </div>
  );
}
