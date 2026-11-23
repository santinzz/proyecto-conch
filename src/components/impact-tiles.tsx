import type { ImpactTotals } from "@/lib/points/impact-summary";

const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

/**
 * Cifras del impacto como una lista de renglones: la etiqueta a la izquierda y
 * el número grande a la derecha, con los dígitos alineados. La marca de color
 * coincide con el color de esa métrica en la gráfica semanal.
 */
export function ImpactTiles({ totals, extra = [] }: { totals: ImpactTotals; extra?: { label: string; value: string }[] }) {
  const rows = [
    { label: "kg de CO₂ evitados", value: num.format(totals.co2Kg), color: "var(--chart-1)" },
    { label: "kWh de luz ahorrados", value: num.format(totals.kwh), color: "var(--chart-1)" },
    { label: "litros de agua ahorrados", value: num.format(totals.liters), color: "var(--chart-2)" },
    { label: "envases evitados", value: num.format(totals.containers), color: "var(--chart-3)" },
    { label: "piezas recicladas", value: num.format(totals.pieces), color: "var(--chart-4)" },
    ...extra.map((e) => ({ ...e, color: "transparent" })),
  ];
  return (
    <dl className="divide-y border-y sm:grid sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-4 py-3 sm:border-b">
          <dt className="flex items-center gap-2 text-sm text-muted-foreground">
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
            {r.label}
          </dt>
          <dd className="font-heading text-3xl font-bold tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
