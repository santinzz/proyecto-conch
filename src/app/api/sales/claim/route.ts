import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PointsError } from "@/lib/points/ledger";
import { getQrSecret } from "@/lib/qr";
import { rateLimit } from "@/lib/rate-limit";
import { claimSale, claimSaleSchema, SaleError } from "@/lib/sales";

const STATUS: Record<SaleError["code"], number> = {
  EMPTY_SALE: 400,
  PRODUCT_NOT_FOUND: 400,
  INVALID_TICKET: 400,
  EXPIRED: 410,
  ALREADY_CLAIMED: 409,
  OWN_SALE: 403,
};

// POST /api/sales/claim · Usuario con sesión · Canjea el QR de un ticket; acredita una sola vez.
export async function POST(request: Request) {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;

  if (!rateLimit(`claim:${auth.user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
  }

  const parsed = claimSaleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "QR inválido", code: "INVALID_TICKET" }, { status: 400 });

  try {
    const result = await db.$transaction((tx) =>
      claimSale(tx, { userId: auth.user.id, token: parsed.data.token, secret: getQrSecret() }),
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof SaleError) return NextResponse.json({ error: e.message, code: e.code }, { status: STATUS[e.code] });
    if (e instanceof PointsError && e.code === "ALREADY_CREDITED") {
      return NextResponse.json({ error: "Este ticket ya se canjeó", code: "ALREADY_CLAIMED" }, { status: 409 });
    }
    throw e;
  }
}
