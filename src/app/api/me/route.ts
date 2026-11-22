import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { userImpact } from "@/lib/impact-stats";
import { balanceOf, earnedInLevelWindow } from "@/lib/points/ledger";
import { levelFor } from "@/lib/points/levels";

// GET /api/me · Cliente · Saldo, nivel, progreso e impacto acumulado.
export async function GET() {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;
  const [balance, earned, impact] = await Promise.all([
    balanceOf(db, auth.user.id),
    earnedInLevelWindow(db, auth.user.id),
    userImpact(db, auth.user.id),
  ]);
  return NextResponse.json({
    user: { id: auth.user.id, name: auth.user.name, role: auth.user.role },
    balance,
    level: levelFor(earned),
    impact: impact.totals,
  });
}
