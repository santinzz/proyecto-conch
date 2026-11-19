import { describe, expect, test } from "vitest";
import { billImpact, getEmissionFactor, litersFromM3 } from "./impact";

describe("impacto", () => {
  test("kWh ahorrados × FE_SEN = kg de CO₂", () => {
    expect(billImpact("ELECTRICITY", 60, 0.444)).toEqual({ kwh: 60, co2Kg: 26.64 });
  });

  test("el agua se guarda en m³ y se muestra en litros", () => {
    expect(billImpact("WATER", 2.5, 0.444)).toEqual({ m3: 2.5 });
    expect(litersFromM3(2.5)).toBe(2500);
  });

  test("sin ahorro, sin CO₂", () => {
    expect(billImpact("ELECTRICITY", 0, 0.444)).toEqual({ kwh: 0, co2Kg: 0 });
  });

  test("FE_SEN sale del entorno y debe ser válido", () => {
    expect(getEmissionFactor({ FE_SEN: "0.444" })).toBe(0.444);
    expect(() => getEmissionFactor({})).toThrow();
    expect(() => getEmissionFactor({ FE_SEN: "abc" })).toThrow();
    expect(() => getEmissionFactor({ FE_SEN: "0" })).toThrow();
  });
});
