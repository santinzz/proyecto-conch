import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { BILL_ERROR_STATUS, BillError, reviewBill, reviewBillSchema } from "@/lib/bills";
import { db } from "@/lib/db";
import { PointsError } from "@/lib/points/ledger";
import { getEmissionFactor } from "@/lib/points/impact";

// POST /api/bills/:id/review · Operador · Aprueba (acredita puntos) o rechaza con motivo.
export async function POST(request: Request, ctx: RouteContext<"/api/bills/[id]/review">) {
  const auth = await authorizeApi(AREA_ROLES.operador);
  if ("response" in auth) return auth.response;

  const parsed = reviewBillSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });

  const { id } = await ctx.params;
  try {
    const result = await db.$transaction((tx) =>
      reviewBill(tx, {
        reviewerId: auth.user.id,
        billId: id,
        action: parsed.data.action,
        note: parsed.data.note,
        feSen: getEmissionFactor(),
      }),
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BillError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: BILL_ERROR_STATUS[e.code] });
    }
    if (e instanceof PointsError && e.code === "ALREADY_CREDITED") {
      return NextResponse.json({ error: "Este recibo ya se acreditó", code: "NOT_PENDING" }, { status: 409 });
    }
    throw e;
  }
}
