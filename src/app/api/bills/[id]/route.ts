import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/session";
import { BILL_ERROR_STATUS, BillError, deleteBill, submitBill, submitBillSchema } from "@/lib/bills";
import { db } from "@/lib/db";

const errorResponse = (e: BillError) =>
  NextResponse.json({ error: e.message, code: e.code }, { status: BILL_ERROR_STATUS[e.code] });

// PATCH /api/bills/:id · Cliente (dueño) · Confirma o corrige los datos y envía a validación.
export async function PATCH(request: Request, ctx: RouteContext<"/api/bills/[id]">) {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;

  const parsed = submitBillSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Revisa los datos del recibo", code: "INVALID_DATA" },
      { status: 400 },
    );
  }

  const { id } = await ctx.params;
  try {
    const result = await db.$transaction((tx) => submitBill(tx, { userId: auth.user.id, billId: id, data: parsed.data }));
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BillError) return errorResponse(e);
    throw e;
  }
}

// DELETE /api/bills/:id · Cliente (dueño) · Borra un borrador o un recibo rechazado.
export async function DELETE(_request: Request, ctx: RouteContext<"/api/bills/[id]">) {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  try {
    await deleteBill(db, { userId: auth.user.id, billId: id });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof BillError) return errorResponse(e);
    throw e;
  }
}
