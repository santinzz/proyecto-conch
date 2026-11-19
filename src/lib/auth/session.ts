import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type SessionUser = { id: string; name: string; email: string; role: Role };

// Quién puede entrar a cada área. El admin también puede operar la caja.
export const AREA_ROLES = {
  operador: ["OPERATOR", "ADMIN"],
  admin: ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

/**
 * Usuario actual leído de la base de datos (no del token), para que un cambio de
 * rol o una cuenta borrada tengan efecto inmediato. null si no hay sesión.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
}

/** Para páginas: exige sesión y, si se indican, uno de los roles. */
export async function requireUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/sin-permiso");
  return user;
}

/**
 * Para route handlers: devuelve el usuario o una respuesta 401/403 lista.
 *   const result = await authorizeApi(["OPERATOR"]);
 *   if ("response" in result) return result.response;
 */
export async function authorizeApi(
  roles?: readonly Role[],
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Inicia sesión" }, { status: 401 }) };
  }
  if (roles && !roles.includes(user.role)) {
    return { response: NextResponse.json({ error: "No tienes permiso" }, { status: 403 }) };
  }
  return { user };
}
