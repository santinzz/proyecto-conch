import type { Metadata } from "next";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ecoScore } from "@/lib/points/eco-score";
import { CashRegister } from "./cash-register";

export const metadata: Metadata = { title: "Caja" };

export default async function CajaPage() {
  await requireUser(AREA_ROLES.operador);
  const products = await db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <CashRegister
      products={products.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents, ecoScore: ecoScore(p) }))}
    />
  );
}
