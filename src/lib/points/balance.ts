import "server-only";
import { db } from "@/lib/db";

/** Saldo = suma de PointEntry del usuario. Nunca se guarda como campo. */
export async function getBalance(userId: string): Promise<number> {
  const result = await db.pointEntry.aggregate({ where: { userId }, _sum: { points: true } });
  return result._sum.points ?? 0;
}
