import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PointsError } from "@/lib/points/ledger";
import { getQrSecret, ticketUrl } from "@/lib/qr";
import { createSale, createSaleSchema, SaleError } from "@/lib/sales";

// POST /api/sales · Operador · Crea la venta del stand y devuelve el contenido del QR firmado.
export async function POST(request: Request) {
  const auth = await authorizeApi(AREA_ROLES.operador);
  if ("response" in auth) return auth.response;

  const parsed = createSaleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos de la venta no válidos" }, { status: 400 });

  try {
    const { sale, lines, token } = await createSale(db, {
      ...parsed.data,
      operatorId: auth.user.id,
      secret: getQrSecret(),
    });
    return NextResponse.json(
      {
        saleId: sale.id,
        qr: ticketUrl(new URL(request.url).origin, token),
        expiresAt: sale.expiresAt.toISOString(),
        totalCents: sale.totalCents,
        basePoints: sale.points,
        broughtContainer: sale.broughtContainer,
        lines,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof SaleError) return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    if (e instanceof PointsError) return NextResponse.json({ error: e.message, code: e.code }, { status: 500 });
    throw e;
  }
}
