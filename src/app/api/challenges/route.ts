import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { challengesForUser } from "@/lib/points/challenges";

// GET /api/challenges · Cliente · Retos con el avance del usuario.
export async function GET() {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;
  return NextResponse.json({ challenges: await challengesForUser(db, auth.user.id) });
}
