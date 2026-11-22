import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { ADMIN_ERROR_STATUS, AdminError } from "@/lib/admin/entities";
import { adjustUserPoints } from "@/lib/admin/users";
import { db } from "@/lib/db";
import { PointsError } from "@/lib/points/ledger";

// POST /api/admin/users/:id/adjust · Admin · Ajuste manual de puntos con motivo.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/users/[id]/adjust">) {
  const auth = await authorizeApi(AREA_ROLES.admin);
  if ("response" in auth) return auth.response;
  const body = (await request.json().catch(() => null)) as { points?: unknown; reason?: unknown } | null;

  const { id } = await ctx.params;
  try {
    const { balance } = await db.$transaction((tx) =>
      adjustUserPoints(tx, {
        adminId: auth.user.id,
        userId: id,
        points: Number(body?.points),
        reason: String(body?.reason ?? ""),
      }),
    );
    return NextResponse.json({ balance });
  } catch (e) {
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: ADMIN_ERROR_STATUS[e.code] });
    }
    if (e instanceof PointsError && e.code === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    throw e;
  }
}
