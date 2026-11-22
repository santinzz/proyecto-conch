import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BillFilePreview } from "@/components/bill-file-preview";
import { BillStatusBadge } from "@/components/bill-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { estimateBill } from "@/lib/bills";
import { formatPeriodDate, KIND_LABELS } from "@/lib/bills/labels";
import { db } from "@/lib/db";
import { formatPoints } from "@/lib/format";
import { OCR_TOLERANCE, SUSPICIOUS_REDUCTION_PCT } from "@/lib/points/bill";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Revisar recibo" };

const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const period = (start: Date | null, end: Date | null) =>
  start && end ? `${formatPeriodDate(start)} – ${formatPeriodDate(end)}` : "—";

export default async function RevisarReciboPage({ params }: PageProps<"/operador/recibos/[id]">) {
  const operator = await requireUser(AREA_ROLES.operador);
  const { id } = await params;
  const bill = await db.bill.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true } },
      file: { select: { mimeType: true } },
    },
  });
  if (!bill || bill.status === "DRAFT") notFound();

  const kind = KIND_LABELS[bill.kind];
  const result = await estimateBill(db, bill);
  const entry =
    bill.status === "APPROVED"
      ? await db.pointEntry.findFirst({ where: { type: "BILL_REDUCTION", sourceId: bill.id }, select: { points: true } })
      : null;

  // Por qué se marcó para revisión detallada (SPEC.md, "Recibos").
  const reasons: string[] = [];
  if (bill.ocrConsumption === null) reasons.push("El OCR no pudo leer el consumo: compáralo con el archivo.");
  else if (bill.consumption !== null && Math.abs(bill.consumption - bill.ocrConsumption) / bill.ocrConsumption > OCR_TOLERANCE) {
    reasons.push(`El consumo confirmado difiere más de ${OCR_TOLERANCE * 100}% de lo leído.`);
  }
  if (bill.ocrServiceNumber && bill.ocrServiceNumber !== bill.serviceNumber) {
    reasons.push("El número de servicio no coincide con el leído.");
  }
  if (result && result.estimate.reductionPct > SUSPICIOUS_REDUCTION_PCT) {
    reasons.push(`La reducción es de más de ${SUSPICIOUS_REDUCTION_PCT}%.`);
  }

  const rows: [string, string, string][] = [
    ["Servicio", bill.serviceNumber ?? "—", bill.ocrServiceNumber ?? "—"],
    ["Periodo", period(bill.periodStart, bill.periodEnd), period(bill.ocrPeriodStart, bill.ocrPeriodEnd)],
    [
      `Consumo (${kind.unit})`,
      bill.consumption === null ? "—" : num.format(bill.consumption),
      bill.ocrConsumption === null ? "—" : num.format(bill.ocrConsumption),
    ],
  ];

  return (
    <div className="space-y-4">
      <Link href="/operador/recibos" className="text-sm text-muted-foreground hover:underline">
        ← Recibos pendientes
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          {kind.emoji} {bill.user.name}
        </h1>
        <BillStatusBadge status={bill.status} />
      </div>

      {bill.detailedReview && bill.status === "PENDING" && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="space-y-1 text-sm text-amber-950">
            <p className="font-medium">⚠️ Revisar con detalle</p>
            <ul className="list-disc pl-5">
              {(reasons.length ? reasons : ["Lo confirmado no coincide con lo leído por el OCR."]).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium" />
                <th className="pb-2 font-medium">Confirmado</th>
                <th className="pb-2 font-medium">Leído (OCR)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(([label, confirmed, ocr]) => (
                <tr key={label}>
                  <th className="py-2 pr-2 text-left font-normal text-muted-foreground">{label}</th>
                  <td className="py-2 pr-2 font-medium break-all">{confirmed}</td>
                  <td className="py-2 break-all text-muted-foreground">{ocr}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result && (
            <p className="rounded-lg bg-muted p-3 text-sm">
              {result.prev
                ? `Recibo aprobado anterior: ${period(result.prev.periodStart, result.prev.periodEnd)}, ${num.format(result.prev.consumption ?? 0)} ${kind.unit}. `
                : "Es el primer recibo aprobado de este servicio: queda como punto de partida (0 puntos). "}
              {!result.estimate.baseline &&
                `Reducción diaria: ${num.format(result.estimate.reductionPct)}% → ${formatPoints(result.estimate.points)} puntos.`}
            </p>
          )}
        </CardContent>
      </Card>

      {bill.file && <BillFilePreview billId={bill.id} mimeType={bill.file.mimeType} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Decisión</CardTitle>
        </CardHeader>
        <CardContent>
          {bill.status === "PENDING" ? (
            bill.userId === operator.id ? (
              <p className="text-sm text-muted-foreground">Es tu propio recibo: lo debe validar otra persona del equipo.</p>
            ) : (
              <ReviewForm billId={bill.id} />
            )
          ) : (
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {bill.status === "APPROVED"
                  ? `Aprobado${entry ? ` · ${entry.points > 0 ? `+${formatPoints(entry.points)} puntos` : "punto de partida"}` : ""}`
                  : "Rechazado"}
                {bill.reviewedBy && ` por ${bill.reviewedBy.name}`}
              </p>
              {bill.reviewNote && <p className="text-muted-foreground">{bill.reviewNote}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
