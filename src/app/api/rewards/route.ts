import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";

// GET /api/rewards · Cliente · Catálogo de recompensas.
export async function GET() {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;
  const rewards = await db.reward.findMany({ orderBy: { cost: "asc" } });
  return NextResponse.json({ rewards });
}
