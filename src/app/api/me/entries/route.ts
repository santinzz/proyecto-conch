import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";

const query = z.object({
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/me/entries?cursor=&limit= · Cliente · Historial de movimientos paginado (más reciente primero).
export async function GET(request: Request) {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = query.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "Parámetros no válidos" }, { status: 400 });
  const { cursor, limit } = parsed.data;

  const rows = await db.pointEntry.findMany({
    where: { userId: auth.user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, type: true, points: true, impact: true, createdAt: true },
  });
  const hasMore = rows.length > limit;
  const entries = hasMore ? rows.slice(0, limit) : rows;
  return NextResponse.json({ entries, nextCursor: hasMore ? entries[entries.length - 1].id : null });
}
