// Límites por periodo. Los días y semanas se cuentan en la hora del piloto
// (Ciudad de México), no en UTC: Vercel corre en UTC y sin esto el "día"
// terminaría a las 6 p. m.

export const PILOT_TIME_ZONE = "America/Mexico_City";

/** Recorta lo pedido a lo que queda del límite. Sin límite (null) no recorta. */
export function applyLimit(requested: number, used: number, limit: number | null): number {
  if (requested <= 0) return 0;
  if (limit === null) return requested;
  return Math.max(0, Math.min(requested, limit - used));
}

/** Diferencia en ms entre la hora local de `timeZone` y UTC en ese instante. */
function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Fecha local (año, mes 1-12, día) de un instante en `timeZone`. */
function localDate(date: Date, timeZone: string) {
  const local = new Date(date.getTime() + offsetMs(date, timeZone));
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate() };
}

/** Instante UTC de la medianoche local de y-m-d en `timeZone` (acepta días fuera de rango). */
function localMidnight(y: number, m: number, d: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - offsetMs(new Date(guess), timeZone);
  const corrected = guess - offsetMs(new Date(t), timeZone); // por si hubo cambio de horario
  if (corrected !== t) t = corrected;
  return new Date(t);
}

/**
 * Rango [start, end) del día o de la semana (lunes a domingo) que contiene `at`,
 * en la zona horaria del piloto.
 */
export function periodRange(
  period: "day" | "week",
  at: Date,
  timeZone: string = PILOT_TIME_ZONE,
): { start: Date; end: Date } {
  const { y, m, d } = localDate(at, timeZone);
  if (period === "day") {
    return { start: localMidnight(y, m, d, timeZone), end: localMidnight(y, m, d + 1, timeZone) };
  }
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  const sinceMonday = (weekday + 6) % 7;
  return {
    start: localMidnight(y, m, d - sinceMonday, timeZone),
    end: localMidnight(y, m, d - sinceMonday + 7, timeZone),
  };
}
