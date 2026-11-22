import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { adminMetrics } from "@/lib/impact-stats";

// GET /api/admin/metrics · Admin · Totales del piloto.
export async function GET() {
  const auth = await authorizeApi(AREA_ROLES.admin);
  if ("response" in auth) return auth.response;
  return NextResponse.json(await adminMetrics(db));
}
