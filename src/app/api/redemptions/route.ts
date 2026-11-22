import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PointsError } from "@/lib/points/ledger";
import { rateLimit } from "@/lib/rate-limit";
import { REDEMPTION_ERROR_STATUS, RedemptionError, redeemReward, redeemSchema } from "@/lib/redemptions";

// POST /api/redemptions · Cliente · Canjea una recompensa o dona puntos. Nunca deja saldo negativo.
export async function POST(request: Request) {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;

  if (!rateLimit(`redeem:${auth.user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
  }
  const parsed = redeemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Recompensa no válida" }, { status: 400 });

  try {
    const { redemption, reward, balance } = await db.$transaction((tx) =>
      redeemReward(tx, { userId: auth.user.id, rewardId: parsed.data.rewardId }),
    );
    return NextResponse.json(
      { code: redemption.code, reward: reward.name, isDonation: reward.isDonation, balance },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof RedemptionError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: REDEMPTION_ERROR_STATUS[e.code] });
    }
    if (e instanceof PointsError && e.code === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    throw e;
  }
}
