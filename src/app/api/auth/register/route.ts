import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/auth/schemas";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// POST /api/auth/register · Público · Crea SIEMPRE una cuenta de cliente.
export async function POST(request: Request) {
  if (!rateLimit(`register:${clientIp(request.headers)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;
  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese correo" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await db.user.create({
      data: { name, email, passwordHash, privacyAcceptedAt: new Date() }, // role queda en CUSTOMER por defecto
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    // Dos registros simultáneos con el mismo correo: gana la restricción única.
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya existe una cuenta con ese correo" }, { status: 409 });
    }
    throw e;
  }
}
