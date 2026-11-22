// CSV para abrir en Excel o Google Sheets: UTF-8 con BOM (para los acentos),
// coma como separador y saltos CRLF.

export type CsvValue = string | number | null | undefined;

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Evita que Excel interprete un texto como fórmula (los números negativos sí se dejan).
  if (typeof value === "string" && /^[=+@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
