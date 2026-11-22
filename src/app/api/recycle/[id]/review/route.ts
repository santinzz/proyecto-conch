import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PointsError } from "@/lib/points/ledger";
import { RECYCLE_ERROR_STATUS, RecycleError, recycleReviewSchema, reviewRecycleClaim } from "@/lib/recycle";

// POST /api/recycle/:id/review · Operador · Confirma las piezas (y acredita) o rechaza.
export async function POST(request: Request, ctx: RouteContext<"/api/recycle/[id]/review">) {
  const auth = await authorizeApi(AREA_ROLES.operador);
  if ("response" in auth) return auth.response;

  const parsed = recycleReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Indica de 1 a 100 piezas" }, { status: 400 });

  const { id } = await ctx.params;
  try {
    const result = await db.$transaction((tx) =>
      reviewRecycleClaim(tx, { reviewerId: auth.user.id, claimId: id, ...parsed.data }),
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof RecycleError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: RECYCLE_ERROR_STATUS[e.code] });
    }
    if (e instanceof PointsError && e.code === "ALREADY_CREDITED") {
      return NextResponse.json({ error: "Esta solicitud ya se acreditó", code: "NOT_PENDING" }, { status: 409 });
    }
    throw e;
  }
}
