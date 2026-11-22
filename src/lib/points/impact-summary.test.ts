import { describe, expect, test } from "vitest";
import { summarizeImpact, weekStarts } from "./impact-summary";

const NOW = new Date("2026-11-20T18:00:00Z"); // viernes 20 nov, 12:00 en CDMX
const at = (iso: string) => new Date(iso);

describe("semanas", () => {
  test("de lunes a domingo en hora de CDMX, de la más vieja a la actual", () => {
    expect(weekStarts(NOW, 3)).toEqual([
      at("2026-11-02T06:00:00Z"),
      at("2026-11-09T06:00:00Z"),
      at("2026-11-16T06:00:00Z"),
    ]);
  });
});

describe("resumen de impacto", () => {
  const entries = [
    { impact: { kwh: 60, co2Kg: 26.64 }, createdAt: at("2026-11-19T12:00:00Z") }, // esta semana
    { impact: { m3: 1.5 }, createdAt: at("2026-11-10T12:00:00Z") }, // semana pasada
    { impact: { containers: 1 }, createdAt: at("2026-11-16T05:59:00Z") }, // domingo 15, 23:59 CDMX
    { impact: { pieces: 25, paidPieces: 20 }, createdAt: at("2026-11-17T12:00:00Z") },
    { impact: { containers: 1 }, createdAt: at("2026-09-01T12:00:00Z") }, // fuera de las semanas
    { impact: null, createdAt: at("2026-11-18T12:00:00Z") },
  ];
  const { totals, weekly } = summarizeImpact(entries, { now: NOW, weeks: 3 });

  test("totales de todo el piloto (litros = m³ × 1000)", () => {
    expect(totals).toEqual({ kwh: 60, liters: 1500, co2Kg: 26.64, containers: 2, pieces: 25 });
  });

  test("cada movimiento cae en su semana", () => {
    expect(weekly.map((w) => w.weekStart)).toEqual(weekStarts(NOW, 3));
    expect(weekly[0]).toMatchObject({ kwh: 0, liters: 0, containers: 0 });
    expect(weekly[1]).toMatchObject({ liters: 1500, containers: 1 });
    expect(weekly[2]).toMatchObject({ kwh: 60, co2Kg: 26.64, pieces: 25, containers: 0 });
  });

  test("sin movimientos todo es cero", () => {
    const empty = summarizeImpact([], { now: NOW, weeks: 2 });
    expect(empty.totals).toEqual({ kwh: 0, liters: 0, co2Kg: 0, containers: 0, pieces: 0 });
    expect(empty.weekly).toHaveLength(2);
  });
});
