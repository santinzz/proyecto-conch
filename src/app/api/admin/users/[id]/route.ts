import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { ADMIN_ERROR_STATUS, AdminError } from "@/lib/admin/entities";
import { roleSchema, setUserRole } from "@/lib/admin/users";
import { db } from "@/lib/db";

// PATCH /api/admin/users/:id · Admin · Cambia el rol (nadie cambia el suyo).
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  const auth = await authorizeApi(AREA_ROLES.admin);
  if ("response" in auth) return auth.response;
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Rol no válido" }, { status: 400 });

  const { id } = await ctx.params;
  try {
    return NextResponse.json({ user: await setUserRole(db, { adminId: auth.user.id, userId: id, role: parsed.data.role }) });
  } catch (e) {
    if (e instanceof AdminError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: ADMIN_ERROR_STATUS[e.code] });
    }
    throw e;
  }
}
