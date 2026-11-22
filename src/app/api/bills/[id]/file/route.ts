import { NextResponse } from "next/server";
import { AREA_ROLES, authorizeApi } from "@/lib/auth/session";
import { db } from "@/lib/db";

// GET /api/bills/:id/file · Dueño u operador · La foto o el PDF del recibo.
// Trae datos personales (nombre y dirección): nunca se guarda en caché compartida.
export async function GET(_request: Request, ctx: RouteContext<"/api/bills/[id]/file">) {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  const bill = await db.bill.findUnique({
    where: { id },
    select: { userId: true, file: { select: { mimeType: true, size: true, data: true } } },
  });
  const isStaff = (AREA_ROLES.operador as readonly string[]).includes(auth.user.role);
  if (!bill?.file || (bill.userId !== auth.user.id && !isStaff)) {
    return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
  }

  return new Response(new Uint8Array(bill.file.data), {
    headers: {
      "Content-Type": bill.file.mimeType, // validado por contenido al subirlo
      "Content-Length": String(bill.file.size),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
