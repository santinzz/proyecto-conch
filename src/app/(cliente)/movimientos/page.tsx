import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPoints } from "@/lib/format";
import { ENTRY_LABELS } from "@/lib/points/labels";

export const metadata: Metadata = { title: "Movimientos" };

const PAGE_SIZE = 20;
const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

export default async function MovimientosPage({ searchParams }: PageProps<"/movimientos">) {
  const user = await requireUser();
  const raw = (await searchParams).antes;
  const cursor = typeof raw === "string" && raw.length <= 64 ? raw : undefined;

  const rows = await db.pointEntry.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, type: true, points: true, sourceId: true, createdAt: true },
  });
  const hasMore = rows.length > PAGE_SIZE;
  const entries = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  // Los ajustes muestran el motivo que escribió el admin.
  const adjustmentIds = entries.filter((e) => e.type === "ADJUSTMENT" && e.sourceId).map((e) => e.sourceId!);
  const reasons = new Map(
    (
      await db.adjustment.findMany({
        where: { id: { in: adjustmentIds }, userId: user.id },
        select: { id: true, reason: true },
      })
    ).map((a) => [a.id, a.reason]),
  );

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Inicio
      </Link>
      <h1 className="text-xl font-semibold">Movimientos</h1>
      <Card>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {cursor ? "No hay movimientos más antiguos." : "Aún no tienes movimientos."}
            </p>
          ) : (
            <ul className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-xl" aria-hidden>
                    {ENTRY_LABELS[e.type].emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{ENTRY_LABELS[e.type].label}</p>
                    {e.sourceId && reasons.has(e.sourceId) && (
                      <p className="text-xs text-muted-foreground">{reasons.get(e.sourceId)}</p>
                    )}
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
      <div className="flex justify-between gap-2 text-sm">
        {cursor ? (
          <Link href="/movimientos" className="inline-flex min-h-11 items-center text-primary hover:underline">
            ← Más recientes
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link
            href={`/movimientos?antes=${entries[entries.length - 1].id}`}
            className="inline-flex min-h-11 items-center text-primary hover:underline"
          >
            Más antiguos →
          </Link>
        )}
      </div>
    </div>
  );
}
