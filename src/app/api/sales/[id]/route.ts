import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";

// GET /api/sales/:id · Operador · Estado del ticket para que la caja sepa si ya lo escanearon.
// Un operador solo ve sus propias ventas; el admin ve todas.
export async function GET(_request: Request, ctx: RouteContext<"/api/sales/[id]">) {
  const auth = await authorizeApi(AREA_ROLES.operador);
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  const sale = await db.sale.findUnique({
    where: { id },
    select: { id: true, operatorId: true, claimedAt: true, expiresAt: true, claimedBy: { select: { name: true } } },
  });
  if (!sale || (auth.user.role !== "ADMIN" && sale.operatorId !== auth.user.id)) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    saleId: sale.id,
    claimed: sale.claimedAt !== null,
    claimedAt: sale.claimedAt?.toISOString() ?? null,
    claimedBy: sale.claimedBy?.name.split(" ")[0] ?? null,
    expiresAt: sale.expiresAt.toISOString(),
  });
}
