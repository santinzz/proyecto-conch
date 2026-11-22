import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { ADMIN_ERROR_STATUS, AdminError, isAdminEntity, updateEntity } from "@/lib/admin/entities";
import { db } from "@/lib/db";

// PATCH /api/admin/:entity/:id · Admin · Edita un registro (en reglas, :id es la clave).
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/[entity]/[id]">) {
  const auth = await authorizeApi(AREA_ROLES.admin);
  if ("response" in auth) return auth.response;
  const { entity, id } = await ctx.params;
  if (!isAdminEntity(entity)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    const item = await updateEntity(db, entity, id, await request.json().catch(() => null));
    return NextResponse.json({ item });
  } catch (e) {
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: ADMIN_ERROR_STATUS[e.code] });
    }
    throw e;
  }
}
