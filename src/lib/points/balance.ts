import "server-only";
import { db } from "@/lib/db";
import { balanceOf, earnedInLevelWindow } from "./ledger";
import { type LevelInfo, levelFor } from "./levels";

/** Saldo = suma de PointEntry del usuario. Nunca se guarda como campo. */
export async function getBalance(userId: string): Promise<number> {
  return balanceOf(db, userId);
}

/** Nivel según puntos ganados en los últimos 180 días. */
export async function getLevel(userId: string): Promise<LevelInfo> {
  return levelFor(await earnedInLevelWindow(db, userId));
}
