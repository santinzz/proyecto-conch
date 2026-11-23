import Link from "next/link";
import { LevelStamp } from "@/components/level-stamp";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPoints } from "@/lib/format";
import { userImpact } from "@/lib/impact-stats";
import { getBalance, getLevel } from "@/lib/points/balance";
import { ENTRY_LABELS } from "@/lib/points/labels";

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});
const kg = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

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
  const hasImpact = co2Kg > 0 || containers > 0 || pieces > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Hola, {user.name.split(" ")[0]}</h1>

      {/* Tarjeta de puntos: el único lugar con cempasúchil de toda la pantalla. */}
      <section aria-labelledby="saldo" className="rounded-lg bg-points p-5 text-points-ink">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="saldo" className="font-sans text-sm font-bold">
              Tu saldo
            </h2>
            <p className="mt-1 font-heading text-6xl leading-none font-extrabold tracking-tight tabular-nums">
              {formatPoints(balance)}
            </p>
            <p className="mt-1 text-base font-bold">puntos</p>
          </div>
          <LevelStamp level={level.name} />
        </div>

        <div className="mt-5 space-y-1.5">
          {level.next ? (
            <>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-points-ink/15"
                role="progressbar"
                aria-valuenow={level.next.progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso a ${level.next.name}`}
              >
                <div className="h-full rounded-full bg-points-ink" style={{ width: `${level.next.progressPct}%` }} />
              </div>
              <p className="text-sm">
                Te faltan <strong>{formatPoints(level.next.remaining)}</strong> para llegar a {level.next.name}.
              </p>
            </>
          ) : (
            <p className="text-sm">Llegaste al nivel más alto.</p>
          )}
          {level.purchaseBonusPct > 0 && (
            <p className="text-sm">Tus compras en el stand dan {level.purchaseBonusPct}% más puntos.</p>
          )}
        </div>
      </section>

      <div className="grid gap-2">
        <Button nativeButton={false} className="h-12 w-full text-base font-bold" render={<Link href="/escanear" />}>
          Escanear ticket
        </Button>
        <Button nativeButton={false} variant="outline" className="h-12 w-full text-base" render={<Link href="/recibos" />}>
          Subir recibo de luz o agua
        </Button>
      </div>

      {hasImpact && (
        <p className="text-sm">
          Has evitado <strong>{kg.format(co2Kg)} kg de CO₂</strong>, {containers} {containers === 1 ? "envase" : "envases"}{" "}
          y reciclado {pieces} {pieces === 1 ? "pieza" : "piezas"}.{" "}
          <Link href="/mi-impacto" className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline">
            Ver mi impacto
          </Link>
        </p>
      )}

      <section aria-labelledby="movimientos" className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 id="movimientos" className="text-lg font-bold">
            Últimos movimientos
          </h2>
          <Link href="/movimientos" className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline">
            Ver todos
          </Link>
        </div>
        {entries.length === 0 ? (
          <p className="border-t py-4 text-sm text-muted-foreground">
            Aún no tienes movimientos. Compra en el stand y escanea tu ticket para empezar.
          </p>
        ) : (
          <ul className="divide-y border-t">
            {entries.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{ENTRY_LABELS[e.type].label}</p>
                  <p className="text-xs text-muted-foreground">{dateFmt.format(e.createdAt)}</p>
                </div>
                <span
                  className={`font-heading text-lg font-bold tabular-nums ${
                    e.points > 0 ? "text-primary" : e.points < 0 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {e.points > 0 ? "+" : ""}
                  {formatPoints(e.points)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
