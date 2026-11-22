import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { ADMIN_ERROR_STATUS, AdminError, createEntity, isAdminEntity, listEntity } from "@/lib/admin/entities";
import { db } from "@/lib/db";

// GET /api/admin/:entity · Admin · Lista (products, rules, challenges, rewards, bins).
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/[entity]">) {
  const auth = await authorizeApi(AREA_ROLES.admin);
  if ("response" in auth) return auth.response;
  const { entity } = await ctx.params;
  if (!isAdminEntity(entity)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ items: await listEntity(db, entity) });
}

// POST /api/admin/:entity · Admin · Crea un registro.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/[entity]">) {
  const auth = await authorizeApi(AREA_ROLES.admin);
  if ("response" in auth) return auth.response;
  const { entity } = await ctx.params;
  if (!isAdminEntity(entity)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    const item = await createEntity(db, entity, await request.json().catch(() => null));
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: ADMIN_ERROR_STATUS[e.code] });
    }
    throw e;
  }
}
