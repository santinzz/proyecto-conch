import type { Metadata } from "next";
import Link from "next/link";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ecoScore } from "@/lib/points/eco-score";
import { CashRegister } from "./cash-register";

export const metadata: Metadata = { title: "Caja" };

export default async function CajaPage() {
  await requireUser(AREA_ROLES.operador);
  const products = await db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-3">
      <Link
        href="/operador/cupones"
        className="flex min-h-11 items-center justify-between rounded-xl border px-4 text-sm hover:bg-muted/50"
      >
        <span>🎁 ¿Te enseñan un cupón? Entrégalo aquí</span>
        <span className="text-muted-foreground">Cupones</span>
      </Link>
      <CashRegister
        products={products.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents, ecoScore: ecoScore(p) }))}
      />
    </div>
  );
}
