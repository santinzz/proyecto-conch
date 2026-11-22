import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { BinQr } from "./bin-qr";
import { ClaimReview } from "./claim-review";

export const metadata: Metadata = { title: "Validar reciclaje" };

const dateTime = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

export default async function ValidarReciclajePage() {
  const operator = await requireUser(AREA_ROLES.operador);
  const [claims, bins] = await Promise.all([
    db.recycleClaim.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } }, bin: { select: { name: true } } },
    }),
    db.recycleBin.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/operador" className="text-sm text-muted-foreground hover:underline">
        ← Operador
      </Link>
      <h1 className="text-xl font-semibold">Validar reciclaje</h1>
      <p className="text-sm text-muted-foreground">
        Cuenta las piezas en el contenedor y confirma. Se pagan 5 puntos por pieza, hasta 20 piezas por semana por
        persona.
      </p>

      {claims.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No hay solicitudes pendientes. ✨</CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {claims.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-medium">
                      {c.user.name} · {c.pieces} {c.pieces === 1 ? "pieza" : "piezas"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.bin.name} · {dateTime.format(c.createdAt)}
                    </p>
                  </div>
                  {c.userId === operator.id ? (
                    <p className="text-sm text-muted-foreground">Es tu propia solicitud: la debe confirmar otra persona.</p>
                  ) : (
                    <ClaimReview claimId={c.id} requested={c.pieces} />
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">QR de los contenedores</CardTitle>
          <p className="text-sm text-muted-foreground">Imprímelo y pégalo en el contenedor. Abre la pantalla para registrar piezas.</p>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          {bins.map((b) => (
            <BinQr key={b.id} code={b.code} name={b.name} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
