import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPoints } from "@/lib/format";
import { getBalance, getLevel } from "@/lib/points/balance";
import { userImpact } from "@/lib/impact-stats";
import { ENTRY_LABELS } from "@/lib/points/labels";

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

export default async function InicioPage() {
  // Cada página revisa la sesión por su cuenta (no basta con el layout).
  const user = await requireUser();
  const [balance, level, entries, impact] = await Promise.all([
    getBalance(user.id),
    getLevel(user.id),
    db.pointEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, points: true, createdAt: true },
    }),
    userImpact(db, user.id),
  ]);
  const { co2Kg, containers, pieces } = impact.totals;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Hola, {user.name.split(" ")[0]}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Tu saldo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-4xl font-bold text-primary">
            {formatPoints(balance)} <span className="text-lg font-medium">puntos</span>
          </p>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">
                Nivel {level.name}
                {level.purchaseBonusPct > 0 && (
                  <span className="text-muted-foreground"> · +{level.purchaseBonusPct}% en compras</span>
                )}
              </span>
              {level.next && (
                <span className="text-muted-foreground">
                  {formatPoints(level.next.remaining)} para {level.next.name}
                </span>
              )}
            </div>
            {level.next && (
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={level.next.progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso a ${level.next.name}`}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${level.next.progressPct}%` }} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Link
        href="/mi-impacto"
        className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm hover:bg-muted/50"
      >
        <span>
          🌍 <span className="font-semibold">{co2Kg.toLocaleString("es-MX", { maximumFractionDigits: 1 })} kg de CO₂</span>{" "}
          evitados · {containers} envases · {pieces} piezas
        </span>
        <span className="shrink-0 text-muted-foreground">Mi impacto →</span>
      </Link>

      <Button nativeButton={false} className="h-12 w-full text-base" render={<Link href="/escanear" />}>
        📷 Escanear QR
      </Button>
      <Button nativeButton={false} variant="outline" className="h-12 w-full text-base" render={<Link href="/recibos" />}>
        💡 Subir recibo de luz o agua
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            Últimos movimientos
            <Link href="/movimientos" className="inline-flex min-h-11 items-center text-sm font-normal text-primary hover:underline">
              Ver todos
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aún no tienes movimientos. Compra en el stand y escanea tu ticket para empezar.
            </p>
          ) : (
            <ul className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-xl" aria-hidden>
                    {ENTRY_LABELS[e.type].emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ENTRY_LABELS[e.type].label}</p>
                    <p className="text-xs text-muted-foreground">{dateFmt.format(e.createdAt)}</p>
                  </div>
                  <span
                    className={`font-semibold tabular-nums ${e.points > 0 ? "text-primary" : e.points < 0 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {e.points > 0 ? "+" : ""}
                    {formatPoints(e.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
