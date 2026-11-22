import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { movementsCsv, weeklyCsv } from "@/lib/impact-stats";

// GET /api/admin/export.csv?tipo=movimientos|semanas · Admin · Exportación para el reporte.
// Las personas aparecen con un seudónimo, sin nombre ni correo.
export async function GET(request: Request) {
  const auth = await authorizeApi(AREA_ROLES.admin);
  if ("response" in auth) return auth.response;

  const kind = new URL(request.url).searchParams.get("tipo") === "semanas" ? "semanas" : "movimientos";
  const csv = kind === "semanas" ? await weeklyCsv(db) : await movementsCsv(db);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ecopuntos-${kind}-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
