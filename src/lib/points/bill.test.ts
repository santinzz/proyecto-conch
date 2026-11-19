import { describe, expect, test } from "vitest";
import { billReduction, dailyAverage, needsDetailedReview, periodDays } from "./bill";

const RULE = { pointsPer5Pct: 50, maxPerBill: 200 };

/** Recibo de `days` días que termina en `end`, con consumo total `consumption`. */
function bill(consumption: number, days = 60, end = "2026-11-01") {
  const periodEnd = new Date(`${end}T00:00:00Z`);
  const periodStart = new Date(periodEnd.getTime() - days * 86_400_000);
  return { periodStart, periodEnd, consumption };
}

describe("periodDays y dailyAverage", () => {
  test("cuenta los días del periodo", () => {
    expect(periodDays(bill(100, 61))).toBe(61);
    expect(dailyAverage(bill(300, 60))).toBe(5);
  });

  test("rechaza periodos vacíos o invertidos y consumos negativos", () => {
    expect(() => periodDays(bill(100, 0))).toThrow();
    expect(() => periodDays(bill(100, -5))).toThrow();
    expect(() => dailyAverage(bill(-1))).toThrow();
  });
});

describe("billReduction", () => {
  test("primer recibo sin línea base da 0 puntos", () => {
    expect(billReduction(null, bill(300), RULE)).toEqual({ baseline: true, reductionPct: 0, points: 0, saved: 0 });
  });

  test("0% de reducción da 0", () => {
    expect(billReduction(bill(300), bill(300), RULE)).toMatchObject({ baseline: false, reductionPct: 0, points: 0, saved: 0 });
  });

  test("consumo mayor (reducción negativa) da 0 y no cuenta ahorro", () => {
    const r = billReduction(bill(300), bill(360), RULE);
    expect(r.reductionPct).toBe(-20);
    expect(r.points).toBe(0);
    expect(r.saved).toBe(0);
  });

  test("menos de 5% da 0", () => {
    expect(billReduction(bill(300), bill(286), RULE).points).toBe(0); // 4.67%
  });

  test("exactamente 5% da 50 (sin error de punto flotante)", () => {
    const r = billReduction(bill(300), bill(285), RULE);
    expect(r.reductionPct).toBe(5);
    expect(r.points).toBe(50);
  });

  test("solo cuentan los bloques de 5% completos", () => {
    expect(billReduction(bill(300), bill(267), RULE).points).toBe(100); // 11% → 2 bloques
  });

  test("15% da 150", () => {
    expect(billReduction(bill(1000), bill(850), RULE).points).toBe(150);
  });

  test("20% llega justo al tope de 200", () => {
    expect(billReduction(bill(1000), bill(800), RULE).points).toBe(200);
  });

  test("50% de reducción queda topado en 200", () => {
    const r = billReduction(bill(1000), bill(500), RULE);
    expect(r.reductionPct).toBe(50);
    expect(r.points).toBe(200);
  });

  test("el tope sale de la regla", () => {
    expect(billReduction(bill(1000), bill(500), { pointsPer5Pct: 50, maxPerBill: null }).points).toBe(500);
    expect(billReduction(bill(1000), bill(500), { pointsPer5Pct: 50, maxPerBill: 300 }).points).toBe(300);
  });

  test("periodos de distinta duración comparan el promedio diario", () => {
    // Anterior: 600 kWh en 60 días = 10/día. Actual: 540 kWh en 61 días ≈ 8.85/día → 11.48%
    const r = billReduction(bill(600, 60, "2026-09-01"), bill(540, 61), RULE);
    expect(r.reductionPct).toBe(11.48);
    expect(r.points).toBe(100);
    // Comparar totales daría 10% → también 100, pero el ahorro usa el promedio:
    expect(r.saved).toBe(70); // (10 − 8.852…) × 61
  });

  test("mismo consumo total en un periodo más largo sí es reducción", () => {
    const r = billReduction(bill(600, 60, "2026-09-01"), bill(600, 66), RULE);
    expect(r.reductionPct).toBe(9.09);
    expect(r.points).toBe(50);
  });

  test("calcula kWh ahorrados como diferencia diaria × días actuales", () => {
    expect(billReduction(bill(300, 60), bill(240, 60), RULE).saved).toBe(60);
  });

  test("anterior con consumo 0 no divide entre cero", () => {
    expect(billReduction(bill(0), bill(100), RULE)).toMatchObject({ points: 0, saved: 0 });
  });
});

describe("needsDetailedReview", () => {
  test("OCR y confirmado parecidos y reducción normal: no", () => {
    expect(needsDetailedReview({ confirmed: 305, ocr: 300, reductionPct: 10 })).toBe(false);
  });

  test("exactamente 10% de diferencia todavía es aceptable", () => {
    expect(needsDetailedReview({ confirmed: 330, ocr: 300, reductionPct: 10 })).toBe(false);
  });

  test("más de 10% de diferencia con el OCR: sí", () => {
    expect(needsDetailedReview({ confirmed: 250, ocr: 300, reductionPct: 10 })).toBe(true);
    expect(needsDetailedReview({ confirmed: 340, ocr: 300, reductionPct: 10 })).toBe(true);
  });

  test("OCR falló (sin lectura): sí", () => {
    expect(needsDetailedReview({ confirmed: 300, ocr: null, reductionPct: 0 })).toBe(true);
  });

  test("reducción mayor a 50%: sí; exactamente 50%: no", () => {
    expect(needsDetailedReview({ confirmed: 100, ocr: 100, reductionPct: 50.01 })).toBe(true);
    expect(needsDetailedReview({ confirmed: 100, ocr: 100, reductionPct: 50 })).toBe(false);
  });
});
