import { describe, expect, test } from "vitest";
import { findDates, normalizeText, parseBillText } from "./parse";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("recibo de CFE", () => {
  const cfe = `
    COMISIÓN FEDERAL DE ELECTRICIDAD
    JUAN PÉREZ LÓPEZ
    NO. DE SERVICIO: 123 456 789 012       TARIFA: 1
    PERIODO FACTURADO: 13 SEP 25 - 13 NOV 25
    Lectura actual  12,345    Lectura anterior  12,045
    Total periodo   300
    Básico 150 kWh  Intermedio 130 kWh  Excedente 20 kWh
    Consumo histórico: 13 JUL 25 - 13 SEP 25  320 kWh
  `;

  test("lee servicio, periodo y consumo", () => {
    expect(parseBillText(cfe, "ELECTRICITY")).toEqual({
      serviceNumber: "123456789012",
      periodStart: d("2025-09-13"),
      periodEnd: d("2025-11-13"),
      consumption: 300,
    });
  });

  test("sin 'Total periodo' usa la diferencia de lecturas", () => {
    const text = cfe.replace(/Total periodo\s+300/, "");
    expect(parseBillText(text, "ELECTRICITY").consumption).toBe(300);
  });

  test("servicio sin etiqueta: 12 dígitos sueltos", () => {
    expect(parseBillText("Cliente 999888777666 tarifa 1", "ELECTRICITY").serviceNumber).toBe("999888777666");
  });

  test("consumo con 'kWh' en el texto", () => {
    expect(parseBillText("Consumo total (kWh): 1,250", "ELECTRICITY").consumption).toBe(1250);
    expect(parseBillText("Energía consumida 245 kWh", "ELECTRICITY").consumption).toBe(245);
  });
});

describe("recibo de agua", () => {
  test("lee contrato, periodo numérico y m³", () => {
    const text = `SIMAS  No. de cuenta: 04-1234-56
      Periodo de consumo del 01/09/2025 al 30/09/2025
      Consumo 18 m³`;
    expect(parseBillText(text, "WATER")).toEqual({
      serviceNumber: "04-1234-56",
      periodStart: d("2025-09-01"),
      periodEnd: d("2025-09-30"),
      consumption: 18,
    });
  });
});

describe("casos difíciles", () => {
  test("texto vacío o ilegible: todo null (el usuario escribe los datos)", () => {
    expect(parseBillText("@@ ## ~~", "ELECTRICITY")).toEqual({
      serviceNumber: null,
      periodStart: null,
      periodEnd: null,
      consumption: null,
    });
  });

  test("ignora periodos imposibles o demasiado largos", () => {
    const text = "PERIODO 01 ENE 25 - 15 ENE 25 ... 01 ENE 25 - 30 JUN 25";
    const parsed = parseBillText(text, "ELECTRICITY");
    expect(parsed.periodStart).toBeNull();
    expect(parsed.periodEnd).toBeNull();
  });

  test("fechas con mes completo y año de 4 dígitos", () => {
    expect(findDates(normalizeText("del 3 de septiembre de 2025 al 2 de noviembre de 2025"))).toEqual([
      d("2025-09-03"),
      d("2025-11-02"),
    ]);
  });

  test("descarta fechas inválidas", () => {
    expect(findDates("31/02/2025 y 30 FEB 25")).toEqual([]);
  });
});
