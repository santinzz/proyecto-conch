import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { formatPeriodDate, KIND_LABELS } from "@/lib/bills/labels";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Validar recibos" };

const dateTime = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

export default async function ValidarRecibosPage() {
  await requireUser(AREA_ROLES.operador);
  const bills = await db.bill.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      kind: true,
      periodStart: true,
      periodEnd: true,
      consumption: true,
      detailedReview: true,
      submittedAt: true,
      user: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <Link href="/operador" className="text-sm text-muted-foreground hover:underline">
        ← Operador
      </Link>
      <h1 className="text-xl font-semibold">Validar recibos</h1>

      {bills.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay recibos pendientes. ✨
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {bills.map((b) => (
            <li key={b.id}>
              <Link href={`/operador/recibos/${b.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden>
                      {KIND_LABELS[b.kind].emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.periodStart && b.periodEnd
                          ? `${formatPeriodDate(b.periodStart)} – ${formatPeriodDate(b.periodEnd)}`
                          : ""}
                        {b.submittedAt && ` · enviado ${dateTime.format(b.submittedAt)}`}
                      </p>
                    </div>
                    {b.detailedReview && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                        ⚠️ Revisar con detalle
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
