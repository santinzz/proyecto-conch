// Administración de personas (Fase 7): roles, ajustes de puntos y cierre del piloto.
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { adjustPoints, type Tx } from "@/lib/points/ledger";
import { AdminError } from "./entities";

export const roleSchema = z.object({ role: z.enum(["CUSTOMER", "OPERATOR", "ADMIN"]) });

export const adjustSchema = z.object({
  points: z
    .int("Usa un número entero")
    .min(-10_000)
    .max(10_000)
    .refine((n) => n !== 0, "El ajuste no puede ser 0"),
  reason: z.string().trim().min(5, "Explica el motivo (mínimo 5 letras)").max(200),
});

/** Cambia el rol. Nadie cambia el suyo (así un admin no se quita el acceso por error). */
export async function setUserRole(client: Tx, input: { adminId: string; userId: string; role: Role }) {
  if (input.adminId === input.userId) throw new AdminError("NOT_ALLOWED", "No puedes cambiar tu propio rol");
  const user = await client.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new AdminError("NOT_FOUND", "No se encontró a la persona");
  return client.user.update({
    where: { id: input.userId },
    data: { role: input.role },
    select: { id: true, name: true, role: true },
  });
}

/** Ajuste manual con motivo. Debe llamarse dentro de db.$transaction. */
export async function adjustUserPoints(
  tx: Tx,
  input: { adminId: string; userId: string; points: number; reason: string; now?: Date },
) {
  if (input.adminId === input.userId) throw new AdminError("NOT_ALLOWED", "No puedes ajustar tus propios puntos");
  const parsed = adjustSchema.safeParse({ points: input.points, reason: input.reason });
  if (!parsed.success) throw new AdminError("INVALID", parsed.error.issues[0]?.message ?? "Datos no válidos");
  const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new AdminError("NOT_FOUND", "No se encontró a la persona");

  const now = input.now ?? new Date();
  const adjustment = await tx.adjustment.create({
    data: { userId: input.userId, adminId: input.adminId, ...parsed.data, createdAt: now },
  });
  const { balance } = await adjustPoints(tx, {
    userId: input.userId,
    adjustmentId: adjustment.id,
    points: parsed.data.points,
    now,
  });
  return { adjustment, balance };
}

/** Archivos de recibos guardados: cuántos y cuánto pesan, y cuántos están en revisión. */
export async function billFileStats(client: Tx) {
  const [all, pending] = await Promise.all([
    client.billFile.aggregate({ _count: { _all: true }, _sum: { size: true } }),
    client.billFile.count({ where: { bill: { status: "PENDING" } } }),
  ]);
  return { files: all._count._all, bytes: all._sum.size ?? 0, pending };
}

/**
 * Cierre del piloto (aviso de privacidad): borra las fotos y PDF de los recibos.
 * Se conservan número de servicio, periodo y consumo. Los recibos que siguen en
 * revisión conservan su archivo para que el operador pueda terminar.
 */
export async function purgeBillFiles(client: Tx) {
  const deleted = await client.billFile.deleteMany({ where: { bill: { status: { not: "PENDING" } } } });
  return { deleted: deleted.count };
}
