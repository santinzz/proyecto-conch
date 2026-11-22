import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { findCoupon } from "@/lib/redemptions";

// GET /api/redemptions/:code · Operador · Consulta un cupón antes de entregarlo.
export async function GET(_request: Request, ctx: RouteContext<"/api/redemptions/[code]">) {
  const auth = await authorizeApi(AREA_ROLES.operador);
  if ("response" in auth) return auth.response;

  const { code } = await ctx.params;
  const coupon = await findCoupon(db, decodeURIComponent(code));
  if (!coupon) return NextResponse.json({ error: "No existe un cupón con ese código" }, { status: 404 });
  return NextResponse.json({
    code: coupon.code,
    reward: coupon.reward.name,
    isDonation: coupon.reward.isDonation,
    customer: coupon.user.name,
    createdAt: coupon.createdAt.toISOString(),
    usedAt: coupon.usedAt?.toISOString() ?? null,
    usedBy: coupon.usedBy?.name ?? null,
  });
}
