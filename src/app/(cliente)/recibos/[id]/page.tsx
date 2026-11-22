import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BillFilePreview } from "@/components/bill-file-preview";
import { BillStatusBadge } from "@/components/bill-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { estimateBill } from "@/lib/bills";
import { formatPeriodDate, KIND_LABELS, toDateInput } from "@/lib/bills/labels";
import { db } from "@/lib/db";
import { formatPoints } from "@/lib/format";
import type { ImpactData } from "@/lib/points/impact";
import { ConfirmForm } from "./confirm-form";
import { DeleteBillButton } from "./delete-button";

export const metadata: Metadata = { title: "Recibo" };

const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export default async function ReciboPage({ params }: PageProps<"/recibos/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const bill = await db.bill.findFirst({
    where: { id, userId: user.id },
    include: { file: { select: { mimeType: true } } },
  });
  if (!bill) notFound();

  const kind = KIND_LABELS[bill.kind];
  const editable = bill.status === "DRAFT" || bill.status === "REJECTED";
  const estimate = bill.status === "PENDING" ? await estimateBill(db, bill) : null;
  const entry =
    bill.status === "APPROVED"
      ? await db.pointEntry.findFirst({
          where: { type: "BILL_REDUCTION", sourceId: bill.id },
          select: { points: true, impact: true },
        })
      : null;
  const impact = entry?.impact as ImpactData | null | undefined;

  // Al corregir uno rechazado se parte de lo que el usuario ya había confirmado.
  const useConfirmed = bill.status === "REJECTED";
  const initial = {
    serviceNumber: (useConfirmed ? bill.serviceNumber : bill.ocrServiceNumber) ?? "",
    periodStart: toDateInput(useConfirmed ? bill.periodStart : bill.ocrPeriodStart),
    periodEnd: toDateInput(useConfirmed ? bill.periodEnd : bill.ocrPeriodEnd),
    consumption: String((useConfirmed ? bill.consumption : bill.ocrConsumption) ?? ""),
  };
  const readByOcr = [bill.ocrServiceNumber, bill.ocrPeriodStart, bill.ocrConsumption].some((v) => v !== null);

  return (
    <div className="space-y-4">
      <Link href="/recibos" className="text-sm text-muted-foreground hover:underline">
        ← Mis recibos
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          {kind.emoji} Recibo de {kind.short.toLowerCase()}
        </h1>
        <BillStatusBadge status={bill.status} />
      </div>

      {bill.status === "REJECTED" && bill.reviewNote && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">El equipo lo rechazó:</p>
            <p>{bill.reviewNote}</p>
            <p className="text-muted-foreground">Corrige los datos y vuelve a enviarlo, o bórralo y sube otro archivo.</p>
          </CardContent>
        </Card>
      )}

      {editable && (
        <Card>
          <CardContent>
            <ConfirmForm
              billId={bill.id}
              kind={bill.kind}
              unit={kind.unit}
              initial={initial}
              readByOcr={useConfirmed || readByOcr}
            />
          </CardContent>
        </Card>
      )}

      {!editable && bill.periodStart && bill.periodEnd && (
        <Card>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Servicio</dt>
              <dd className="font-medium break-all">{bill.serviceNumber}</dd>
              <dt className="text-muted-foreground">Periodo</dt>
              <dd className="font-medium">
                {formatPeriodDate(bill.periodStart)} – {formatPeriodDate(bill.periodEnd)}
              </dd>
              <dt className="text-muted-foreground">Consumo</dt>
              <dd className="font-medium">
                {num.format(bill.consumption ?? 0)} {kind.unit}
              </dd>
            </dl>

            {bill.status === "PENDING" && estimate && (
              <p className="rounded-lg bg-muted p-3">
                {estimate.estimate.baseline
                  ? "Todavía no hay un recibo aprobado anterior de este servicio para comparar: por ahora cuenta como punto de partida (0 puntos). Con los siguientes podrás ganar."
                  : estimate.estimate.points > 0
                    ? `Consumiste ${num.format(estimate.estimate.reductionPct)}% menos por día que en tu recibo anterior. Si se aprueba, ganarás ${formatPoints(estimate.estimate.points)} puntos.`
                    : "No bajó tu consumo diario respecto al recibo anterior, así que este no suma puntos. ¡Sigue intentando!"}
              </p>
            )}

            {bill.status === "APPROVED" && entry && (
              <div className="rounded-lg bg-primary/10 p-3">
                <p className="text-lg font-semibold text-primary">
                  {entry.points > 0 ? `+${formatPoints(entry.points)} puntos` : "Aprobado como punto de partida"}
                </p>
                {impact?.kwh ? (
                  <p>
                    Ahorraste {num.format(impact.kwh)} kWh, {num.format(impact.co2Kg ?? 0)} kg de CO₂ evitados.
                  </p>
                ) : impact?.m3 ? (
                  <p>Ahorraste {num.format(impact.m3 * 1000)} litros de agua.</p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {bill.file && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Archivo</CardTitle>
          </CardHeader>
          <CardContent>
            <BillFilePreview billId={bill.id} mimeType={bill.file.mimeType} />
          </CardContent>
        </Card>
      )}

      {editable && <DeleteBillButton billId={bill.id} />}
    </div>
  );
}
