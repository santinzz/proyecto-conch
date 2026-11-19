import { describe, expect, test } from "vitest";
import { applyLimit, periodRange } from "./limits";

describe("applyLimit", () => {
  test("sin uso previo paga lo pedido hasta el límite", () => {
    expect(applyLimit(1, 0, 1)).toBe(1);
    expect(applyLimit(15, 0, 20)).toBe(15);
  });

  test("límite diario alcanzado: 0", () => {
    expect(applyLimit(1, 1, 1)).toBe(0);
  });

  test("recorta al restante (límite semanal parcial)", () => {
    expect(applyLimit(10, 15, 20)).toBe(5);
  });

  test("uso por encima del límite nunca da negativo", () => {
    expect(applyLimit(3, 25, 20)).toBe(0);
  });

  test("sin límite no recorta; pedir 0 o menos da 0", () => {
    expect(applyLimit(500, 10_000, null)).toBe(500);
    expect(applyLimit(0, 0, 20)).toBe(0);
    expect(applyLimit(-3, 0, 20)).toBe(0);
  });
});

// Ciudad de México está en UTC−6 todo el año.
describe("periodRange (hora de Ciudad de México)", () => {
  test("el día va de medianoche a medianoche local (06:00 UTC)", () => {
    const { start, end } = periodRange("day", new Date("2026-11-19T15:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-19T06:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-20T06:00:00.000Z");
  });

  test("las 11:59 p. m. locales siguen siendo el mismo día", () => {
    const { start } = periodRange("day", new Date("2026-11-20T05:59:00Z")); // 19 nov 23:59 CDMX
    expect(start.toISOString()).toBe("2026-11-19T06:00:00.000Z");
  });

  test("a medianoche local empieza un día nuevo (aunque en UTC sean las 6 a. m.)", () => {
    const { start } = periodRange("day", new Date("2026-11-20T06:00:00Z")); // 20 nov 00:00 CDMX
    expect(start.toISOString()).toBe("2026-11-20T06:00:00.000Z");
  });

  test("las 7 p. m. locales NO son el día siguiente aunque en UTC ya lo sean", () => {
    const { start } = periodRange("day", new Date("2026-11-20T01:00:00Z")); // 19 nov 19:00 CDMX
    expect(start.toISOString()).toBe("2026-11-19T06:00:00.000Z");
  });

  test("la semana va de lunes a domingo", () => {
    // Jueves 19 nov 2026 → semana del lunes 16 al lunes 23
    const { start, end } = periodRange("week", new Date("2026-11-19T15:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-16T06:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-23T06:00:00.000Z");
  });

  test("domingo en la noche sigue en la misma semana; lunes empieza otra", () => {
    const sunday = periodRange("week", new Date("2026-11-23T05:30:00Z")); // dom 22 nov 23:30 CDMX
    expect(sunday.start.toISOString()).toBe("2026-11-16T06:00:00.000Z");
    const monday = periodRange("week", new Date("2026-11-23T06:00:00Z")); // lun 23 nov 00:00 CDMX
    expect(monday.start.toISOString()).toBe("2026-11-23T06:00:00.000Z");
  });

  test("cruza meses y años", () => {
    const { start, end } = periodRange("week", new Date("2027-01-01T18:00:00Z")); // viernes
    expect(start.toISOString()).toBe("2026-12-28T06:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-04T06:00:00.000Z");
  });
});
