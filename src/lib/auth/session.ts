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

/** Ruta interna segura para volver después del login (evita redirecciones a otros sitios). */
export function safeReturnTo(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : null;
}

/**
 * Para páginas: exige sesión y, si se indican, uno de los roles.
 * `returnTo` hace que el login regrese a esa ruta (p. ej. un ticket escaneado).
 */
export async function requireUser(roles?: readonly Role[], options?: { returnTo?: string }): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const next = safeReturnTo(options?.returnTo);
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
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
