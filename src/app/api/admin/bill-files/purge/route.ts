import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { purgeBillFiles } from "@/lib/admin/users";
import { db } from "@/lib/db";

// POST /api/admin/bill-files/purge · Admin · Cierre del piloto: borra las fotos y PDF de los
// recibos ya revisados. Pide { "confirm": "BORRAR" } para que no se dispare por accidente.
export async function POST(request: Request) {
  const auth = await authorizeApi(AREA_ROLES.admin);
  if ("response" in auth) return auth.response;
  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== "BORRAR") {
    return NextResponse.json({ error: 'Escribe "BORRAR" para confirmar' }, { status: 400 });
  }
  return NextResponse.json(await purgeBillFiles(db));
}
