import type { Metadata } from "next";
import Link from "next/link";
import { BillStatusBadge } from "@/components/bill-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { formatPeriodDate, KIND_LABELS } from "@/lib/bills/labels";
import { db } from "@/lib/db";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Mis recibos" };

export default async function RecibosPage() {
  const user = await requireUser();
  const bills = await db.bill.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, status: true, periodStart: true, periodEnd: true },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Mis recibos</h1>
        <p className="text-sm text-muted-foreground">
          Sube tu recibo de luz o agua de cada periodo. Si consumes menos que en el anterior, ganas puntos.
        </p>
      </div>

      <UploadForm />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tus recibos</CardTitle>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aún no subes recibos. El primero de cada servicio sirve como punto de partida.
            </p>
          ) : (
            <ul className="divide-y">
              {bills.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/recibos/${b.id}`}
                    className="-mx-2 flex min-h-11 items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/50"
                  >
                    <span className="text-xl" aria-hidden>
                      {KIND_LABELS[b.kind].emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{KIND_LABELS[b.kind].label}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.periodStart && b.periodEnd
                          ? `${formatPeriodDate(b.periodStart)} – ${formatPeriodDate(b.periodEnd)}`
                          : "Periodo sin confirmar"}
                      </p>
                    </div>
                    <BillStatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
