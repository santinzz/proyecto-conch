import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createRecycleClaim, RECYCLE_ERROR_STATUS, RecycleError, recycleClaimSchema } from "@/lib/recycle";

// POST /api/recycle/claim · Cliente · Solicitud desde el QR del contenedor con el número de piezas.
export async function POST(request: Request) {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;

  if (!rateLimit(`recycle:${auth.user.id}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Intenta más tarde." }, { status: 429 });
  }
  const parsed = recycleClaimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Indica cuántas piezas dejaste (de 1 a 100)" }, { status: 400 });
  }

  try {
    const claim = await createRecycleClaim(db, { userId: auth.user.id, ...parsed.data });
    return NextResponse.json({ id: claim.id, pieces: claim.pieces, status: claim.status }, { status: 201 });
  } catch (e) {
    if (e instanceof RecycleError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: RECYCLE_ERROR_STATUS[e.code] });
    }
    throw e;
  }
}
