// Niveles por puntos GANADOS (sin contar canjes ni donaciones) en los últimos 180 días.

export const LEVEL_WINDOW_DAYS = 180;

export const LEVELS = [
  { name: "Semilla", min: 0, purchaseBonusPct: 0 },
  { name: "Brote", min: 500, purchaseBonusPct: 10 },
  { name: "Árbol", min: 2000, purchaseBonusPct: 20 },
] as const;

export type LevelName = (typeof LEVELS)[number]["name"];

export type LevelInfo = {
  name: LevelName;
  purchaseBonusPct: number;
  earned: number;
  next: { name: LevelName; min: number; remaining: number; progressPct: number } | null;
};

export function levelFor(earned: number): LevelInfo {
  const points = Math.max(0, earned);
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i].min) index = i;

  const current = LEVELS[index];
  const upcoming = LEVELS[index + 1];
  return {
    name: current.name,
    purchaseBonusPct: current.purchaseBonusPct,
    earned: points,
    next: upcoming
      ? {
          name: upcoming.name,
          min: upcoming.min,
          remaining: upcoming.min - points,
          progressPct: Math.floor(((points - current.min) / (upcoming.min - current.min)) * 100),
        }
      : null,
  };
}

/** Inicio de la ventana de 180 días que termina en `now`. */
export function levelWindowStart(now: Date): Date {
  return new Date(now.getTime() - LEVEL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}
