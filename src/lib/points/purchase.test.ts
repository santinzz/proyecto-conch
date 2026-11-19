import { describe, expect, test } from "vitest";
import { SPEC_RULES } from "../../../test/fixtures";
import { linePoints, purchasePoints } from "./purchase";

describe("linePoints", () => {
  test("A da 3 por cada $10 completos del renglón", () => {
    expect(linePoints({ qty: 1, priceCents: 4500, ecoScore: "A" }, SPEC_RULES)).toBe(12); // $45 → 4 × 3
  });

  test("B da 2 y C da 1 por cada $10", () => {
    expect(linePoints({ qty: 1, priceCents: 3000, ecoScore: "B" }, SPEC_RULES)).toBe(6);
    expect(linePoints({ qty: 1, priceCents: 3000, ecoScore: "C" }, SPEC_RULES)).toBe(3);
  });

  test("se calcula sobre el subtotal del renglón, no por unidad", () => {
    // 3 × $5 = $15 → 1 bloque de $10 (por unidad serían 0)
    expect(linePoints({ qty: 3, priceCents: 500, ecoScore: "A" }, SPEC_RULES)).toBe(3);
  });

  test("menos de $10 no da puntos", () => {
    expect(linePoints({ qty: 1, priceCents: 999, ecoScore: "A" }, SPEC_RULES)).toBe(0);
  });

  test("exactamente $10 da un bloque", () => {
    expect(linePoints({ qty: 1, priceCents: 1000, ecoScore: "A" }, SPEC_RULES)).toBe(3);
  });

  test("producto sin Eco Score no da puntos", () => {
    expect(linePoints({ qty: 2, priceCents: 5000, ecoScore: null }, SPEC_RULES)).toBe(0);
  });

  test("usa los valores de la tabla Rule", () => {
    const rules = { ...SPEC_RULES, PURCHASE_A: { points: 5, limitCount: null, limitPeriod: null } };
    expect(linePoints({ qty: 1, priceCents: 2000, ecoScore: "A" }, rules)).toBe(10);
  });

  test("rechaza cantidades y precios no válidos", () => {
    expect(() => linePoints({ qty: 0, priceCents: 1000, ecoScore: "A" }, SPEC_RULES)).toThrow();
    expect(() => linePoints({ qty: 1.5, priceCents: 1000, ecoScore: "A" }, SPEC_RULES)).toThrow();
    expect(() => linePoints({ qty: 1, priceCents: -1, ecoScore: "A" }, SPEC_RULES)).toThrow();
  });
});

describe("purchasePoints", () => {
  const items = [
    { qty: 1, priceCents: 4500, ecoScore: "A" as const }, // 12
    { qty: 2, priceCents: 3000, ecoScore: "B" as const }, // $60 → 12
    { qty: 1, priceCents: 3000, ecoScore: null }, // 0
  ];

  test("suma los renglones sin bono en Semilla", () => {
    expect(purchasePoints(items, SPEC_RULES, 0)).toEqual({ base: 24, bonus: 0, total: 24 });
  });

  test("Brote suma 10% redondeado hacia abajo", () => {
    expect(purchasePoints(items, SPEC_RULES, 10)).toEqual({ base: 24, bonus: 2, total: 26 });
  });

  test("Árbol suma 20%", () => {
    expect(purchasePoints(items, SPEC_RULES, 20)).toEqual({ base: 24, bonus: 4, total: 28 });
  });

  test("venta vacía da 0", () => {
    expect(purchasePoints([], SPEC_RULES, 20)).toEqual({ base: 0, bonus: 0, total: 0 });
  });
});
