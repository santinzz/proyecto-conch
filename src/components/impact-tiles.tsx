import type { ImpactTotals } from "@/lib/points/impact-summary";

const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

/** Cifras grandes del impacto (sin gráfica: un número dice más que una barra sola). */
export function ImpactTiles({ totals, extra = [] }: { totals: ImpactTotals; extra?: { label: string; value: string }[] }) {
  const tiles = [
    { label: "kg de CO₂ evitados", value: num.format(totals.co2Kg), emoji: "🌍" },
    { label: "kWh de luz ahorrados", value: num.format(totals.kwh), emoji: "💡" },
    { label: "litros de agua ahorrados", value: num.format(totals.liters), emoji: "💧" },
    { label: "envases evitados", value: num.format(totals.containers), emoji: "♻️" },
    { label: "piezas recicladas", value: num.format(totals.pieces), emoji: "🗑️" },
    ...extra.map((e) => ({ ...e, emoji: "👥" })),
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <li key={t.label} className="rounded-xl border bg-card p-3">
          <p className="text-2xl font-bold tabular-nums">
            <span aria-hidden className="mr-1 text-lg">
              {t.emoji}
            </span>
            {t.value}
          </p>
          <p className="text-xs text-muted-foreground">{t.label}</p>
        </li>
      ))}
    </ul>
  );
}
