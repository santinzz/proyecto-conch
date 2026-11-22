import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { RecycleForm } from "./recycle-form";

export const metadata: Metadata = { title: "Reciclar" };

const STATUS = {
  PENDING: { label: "Por confirmar", className: "bg-sky-100 text-sky-900" },
  APPROVED: { label: "Confirmado", className: "bg-emerald-100 text-emerald-900" },
  REJECTED: { label: "Rechazado", className: "bg-red-100 text-red-900" },
} as const;

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

// Fuera del grupo (cliente) a propósito, como /escanear: si no hay sesión, el
// login regresa aquí con el contenedor (?bin=…).
export default async function ReciclarPage({ searchParams }: PageProps<"/reciclar">) {
  const raw = (await searchParams).bin;
  const code = typeof raw === "string" ? raw : undefined;
  const user = await requireUser(undefined, {
    returnTo: code ? `/reciclar?bin=${encodeURIComponent(code)}` : "/reciclar",
  });
  const [bin, claims] = await Promise.all([
    code ? db.recycleBin.findUnique({ where: { code } }) : null,
    db.recycleClaim.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { bin: { select: { name: true } } },
    }),
  ]);

  return (
    <AppShell user={user}>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">♻️ Reciclar</h1>

        {bin ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{bin.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{bin.location}</p>
            </CardHeader>
            <CardContent>
              <RecycleForm binCode={bin.code} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {code
                  ? "No encontramos ese contenedor. Escanea otra vez su código QR."
                  : "Escanea el código QR pegado en el contenedor de reciclaje para registrar tus piezas."}
              </p>
              <Button nativeButton={false} className="h-12 w-full text-base" render={<Link href="/escanear" />}>
                📷 Escanear QR del contenedor
              </Button>
            </CardContent>
          </Card>
        )}

        {claims.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tus últimas solicitudes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {claims.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {c.confirmedPieces ?? c.pieces} {(c.confirmedPieces ?? c.pieces) === 1 ? "pieza" : "piezas"}
                        {c.confirmedPieces !== null && c.confirmedPieces !== c.pieces && (
                          <span className="text-muted-foreground"> (dijiste {c.pieces})</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.bin.name} · {dateFmt.format(c.createdAt)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[c.status as keyof typeof STATUS]?.className ?? ""}`}>
                      {STATUS[c.status as keyof typeof STATUS]?.label ?? c.status}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
