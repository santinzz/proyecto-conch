import { describe, expect, test } from "vitest";
import { levelFor, levelWindowStart } from "./levels";

describe("levelFor", () => {
  test("0 puntos = Semilla sin bono", () => {
    expect(levelFor(0)).toMatchObject({ name: "Semilla", purchaseBonusPct: 0 });
  });

  test("499 sigue en Semilla; 500 ya es Brote (+10%)", () => {
    expect(levelFor(499).name).toBe("Semilla");
    expect(levelFor(500)).toMatchObject({ name: "Brote", purchaseBonusPct: 10 });
  });

  test("1,999 sigue en Brote; 2,000 ya es Árbol (+20%)", () => {
    expect(levelFor(1999).name).toBe("Brote");
    expect(levelFor(2000)).toMatchObject({ name: "Árbol", purchaseBonusPct: 20 });
  });

  test("progreso al siguiente nivel", () => {
    expect(levelFor(250).next).toEqual({ name: "Brote", min: 500, remaining: 250, progressPct: 50 });
    expect(levelFor(1250).next).toEqual({ name: "Árbol", min: 2000, remaining: 750, progressPct: 50 });
  });

  test("Árbol no tiene siguiente nivel", () => {
    expect(levelFor(5000).next).toBeNull();
  });

  test("valores negativos se tratan como 0", () => {
    expect(levelFor(-50)).toMatchObject({ name: "Semilla", earned: 0 });
  });
});

test("la ventana de nivel es de 180 días", () => {
  expect(levelWindowStart(new Date("2026-11-19T00:00:00Z")).toISOString()).toBe("2026-05-23T00:00:00.000Z");
});
