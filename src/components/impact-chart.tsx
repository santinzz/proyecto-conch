"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ChartWeek = { label: string; co2Kg: number; liters: number; containers: number; pieces: number };

const METRICS = [
  { key: "co2Kg", tab: "CO₂", title: "kg de CO₂ evitados por semana", unit: "kg de CO₂", color: "var(--chart-1)" },
  { key: "liters", tab: "Agua", title: "Litros de agua ahorrados por semana", unit: "litros", color: "var(--chart-2)" },
  { key: "containers", tab: "Envases", title: "Envases evitados por semana", unit: "envases", color: "var(--chart-3)" },
  { key: "pieces", tab: "Reciclaje", title: "Piezas recicladas por semana", unit: "piezas", color: "var(--chart-4)" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });
const axisText = { fill: "var(--muted-foreground)", fontSize: 12 };

/**
 * Una sola serie a la vez (un color, sin leyenda: el título la nombra). Barras
 * delgadas con la punta redondeada, cuadrícula discreta, tooltip y tabla.
 */
export function ImpactChart({ weeks }: { weeks: ChartWeek[] }) {
  const [metric, setMetric] = useState<MetricKey>("co2Kg");
  const current = METRICS.find((m) => m.key === metric)!;
  const empty = weeks.every((w) => w[metric] === 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-4 overflow-x-auto border-b" role="group" aria-label="Qué mostrar en la gráfica">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={metric === m.key}
            onClick={() => setMetric(m.key)}
            className={`-mb-px min-h-11 border-b-2 text-sm whitespace-nowrap transition-colors ${metric === m.key ? "border-primary font-bold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {m.tab}
          </button>
        ))}
      </div>

      <p className="font-heading text-base font-bold">{current.title}</p>
      {empty ? (
        <p className="grid h-56 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Aún no hay datos en estas semanas
        </p>
      ) : (
      <div className="h-56" style={{ color: current.color }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={axisText} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
            <YAxis
              width={40}
              tick={axisText}
              tickLine={false}
              axisLine={false}
              allowDecimals={metric === "co2Kg"}
              tickFormatter={(v: number) => num.format(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              formatter={(value) => [`${num.format(Number(value))} ${current.unit}`, ""]}
              separator=""
              labelFormatter={(label) => `Semana del ${label}`}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
                fontSize: 13,
              }}
            />
            <Bar dataKey={metric} fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Ver como tabla</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-medium">Semana</th>
              <th className="py-1 text-right font-medium">CO₂ (kg)</th>
              <th className="py-1 text-right font-medium">Agua (L)</th>
              <th className="py-1 text-right font-medium">Envases</th>
              <th className="py-1 text-right font-medium">Piezas</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {weeks.map((w) => (
              <tr key={w.label}>
                <td className="py-1">{w.label}</td>
                <td className="py-1 text-right">{num.format(w.co2Kg)}</td>
                <td className="py-1 text-right">{num.format(w.liters)}</td>
                <td className="py-1 text-right">{w.containers}</td>
                <td className="py-1 text-right">{w.pieces}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
