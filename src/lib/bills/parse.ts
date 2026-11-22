// Lee número de servicio, periodo y consumo del texto de un recibo (OCR o PDF).
//
// Es una ayuda: el usuario siempre confirma o corrige lo leído y el operador lo
// valida. Por eso, ante la duda, es mejor devolver null que un dato inventado.
// Formatos contemplados (CFE y organismos de agua):
//   "NO. DE SERVICIO: 123 456 789 012"      "PERIODO FACTURADO: 13 SEP 25 - 13 NOV 25"
//   "Total periodo 300" / "300 kWh"         "Lectura actual 12345 · Lectura anterior 12045"
//   "Del 01/09/2025 al 30/09/2025"           "Consumo 18 m3"

export type BillKindName = "ELECTRICITY" | "WATER";

export type ParsedBill = {
  serviceNumber: string | null;
  periodStart: Date | null; // medianoche UTC del día
  periodEnd: Date | null;
  consumption: number | null; // kWh o m³
};

const MONTHS: Record<string, number> = {
  ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEP: 8, SET: 8, OCT: 9, NOV: 10, DIC: 11,
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Duración razonable de un periodo de recibo (mensual o bimestral). */
export const MIN_PERIOD_DAYS = 20;
export const MAX_PERIOD_DAYS = 100;

/** Mayúsculas, sin acentos y con espacios normales. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/M³/g, "M3")
    .replace(/[^\S\n]+/g, " ");
}

function utcDate(year: number, month: number, day: number): Date | null {
  if (year < 100) year += 2000;
  const d = new Date(Date.UTC(year, month, day));
  // Descarta fechas imposibles (31 FEB se convertiría en marzo).
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) return null;
  if (year < 2015 || year > 2100) return null;
  return d;
}

const DATE_RE =
  /\b(\d{1,2})\s*(?:DE\s+)?(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEPT?|SET|OCT|NOV|DIC)[A-Z]*\.?\s*(?:DE\s+|DEL\s+)?(\d{4}|\d{2})\b|\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g;

/** Todas las fechas del texto, en orden de aparición. */
export function findDates(text: string): Date[] {
  const dates: Date[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const date = m[1]
      ? utcDate(Number(m[3]), MONTHS[m[2].slice(0, 3)], Number(m[1]))
      : utcDate(Number(m[6]), Number(m[5]) - 1, Number(m[4]));
    if (date) dates.push(date);
  }
  return dates;
}

function plausiblePeriod(start: Date, end: Date): boolean {
  const days = (end.getTime() - start.getTime()) / DAY_MS;
  return days >= MIN_PERIOD_DAYS && days <= MAX_PERIOD_DAYS;
}

function findPeriod(text: string): { start: Date; end: Date } | null {
  // 1) Las dos primeras fechas después de "PERIODO".
  for (const m of text.matchAll(/PERIODO/g)) {
    const window = text.slice(m.index, m.index + 120);
    const [a, b] = findDates(window);
    if (a && b && plausiblePeriod(a, b)) return { start: a, end: b };
  }
  // 2) Cualquier par de fechas seguidas con una duración razonable.
  const dates = findDates(text);
  for (let i = 0; i + 1 < dates.length; i++) {
    if (plausiblePeriod(dates[i], dates[i + 1])) return { start: dates[i], end: dates[i + 1] };
  }
  return null;
}

function findServiceNumber(text: string, kind: BillKindName): string | null {
  const labeled =
    kind === "ELECTRICITY"
      ? /(?:NO|NUM|NUMERO|N)\.?\s*(?:DE\s+)?SERVICIO\s*:?\s*((?:\d[\s-]?){10,14})/
      : /(?:NO\.?\s*DE\s+|NUMERO\s+DE\s+)?(?:CONTRATO|CUENTA|SERVICIO|TOMA)\s*(?:NO\.?|NUM\.?)?\s*:?\s*([A-Z0-9][A-Z0-9-]{3,19})/;
  const m = text.match(labeled);
  if (m) {
    const value = kind === "ELECTRICITY" ? m[1].replace(/\D/g, "") : m[1].replace(/-+$/, "");
    if (kind === "WATER" ? /\d/.test(value) : value.length >= 10) return value;
  }
  if (kind === "ELECTRICITY") {
    // Sin etiqueta: el número de servicio de CFE tiene 12 dígitos (a veces en grupos de 3).
    const loose = text.match(/\b\d{3}\s?\d{3}\s?\d{3}\s?\d{3}\b/);
    if (loose) return loose[0].replace(/\s/g, "");
  }
  return null;
}

const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
const toNumber = (s: string) => Number(s.replace(/,/g, ""));

function findConsumption(text: string, kind: BillKindName): number | null {
  const unit = kind === "ELECTRICITY" ? "KWH" : "M3";
  const candidates = [
    // "Total periodo 300" (cuadro de lecturas de CFE)
    new RegExp(String.raw`TOTAL\s+(?:DEL\s+)?PERIODO\D{0,15}?${NUM}`),
    // "Consumo total (kWh): 300" / "Consumo 18 m3" / "Consumo del periodo 18"
    new RegExp(String.raw`CONSUMO\s*(?:TOTAL|DEL\s+PERIODO|FACTURADO)?\s*(?:\(?\s*${unit}\s*\)?)?\s*:?\s*${NUM}\s*(?:${unit})?`),
    // "Total 300 kWh"
    new RegExp(String.raw`TOTAL\s*:?\s*${NUM}\s*${unit}\b`),
  ];
  for (const re of candidates) {
    const m = text.match(re);
    if (m) {
      const value = toNumber(m[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  // Diferencia de lecturas del medidor.
  const actual = text.match(new RegExp(String.raw`LECTURA\s+ACTUAL\D{0,15}?${NUM}`));
  const previous = text.match(new RegExp(String.raw`LECTURA\s+ANTERIOR\D{0,15}?${NUM}`));
  if (actual && previous) {
    const diff = toNumber(actual[1]) - toNumber(previous[1]);
    if (diff > 0 && diff < 100_000) return Math.round(diff * 1000) / 1000;
  }

  // Último recurso: el primer "N kWh" / "N m3".
  const loose = text.match(new RegExp(String.raw`${NUM}\s*${unit}\b`));
  if (loose) {
    const value = toNumber(loose[1]);
    if (value > 0) return value;
  }
  return null;
}

export function parseBillText(rawText: string, kind: BillKindName): ParsedBill {
  const text = normalizeText(rawText);
  const period = findPeriod(text);
  return {
    serviceNumber: findServiceNumber(text, kind),
    periodStart: period?.start ?? null,
    periodEnd: period?.end ?? null,
    consumption: findConsumption(text, kind),
  };
}
