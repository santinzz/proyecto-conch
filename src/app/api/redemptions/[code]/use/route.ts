import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { REDEMPTION_ERROR_STATUS, RedemptionError, markCouponUsed } from "@/lib/redemptions";

// POST /api/redemptions/:code/use · Operador · Marca el cupón como usado en el stand.
export async function POST(_request: Request, ctx: RouteContext<"/api/redemptions/[code]/use">) {
  const auth = await authorizeApi(AREA_ROLES.operador);
  if ("response" in auth) return auth.response;

  const { code } = await ctx.params;
  try {
    const result = await db.$transaction((tx) =>
      markCouponUsed(tx, { operatorId: auth.user.id, code: decodeURIComponent(code) }),
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof RedemptionError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: REDEMPTION_ERROR_STATUS[e.code] });
    }
    throw e;
  }
}
