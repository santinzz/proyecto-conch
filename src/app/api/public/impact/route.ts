import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pilotImpact } from "@/lib/impact-stats";

// GET /api/public/impact · Público · Totales del piloto, sin datos personales.
export async function GET() {
  const { totals, weekly, participants, activeThisWeek } = await pilotImpact(db);
  return NextResponse.json(
    { totals, weekly, participants, activeThisWeek },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
