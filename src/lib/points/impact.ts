// Impacto ambiental guardado en PointEntry.impact.
export type ImpactData = {
  kwh?: number; // kWh ahorrados
  m3?: number; // m³ de agua ahorrados
  co2Kg?: number; // kg de CO₂ evitados
  containers?: number; // envases evitados
  pieces?: number; // piezas recicladas (aprobadas)
  paidPieces?: number; // de esas, cuántas pagaron puntos (límite semanal)
};

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

/**
 * Factor de emisión del Sistema Eléctrico Nacional (kg CO₂/kWh), de FE_SEN.
 * Falla si no está definido para no reportar CO₂ inventado.
 */
export function getEmissionFactor(env: Record<string, string | undefined> = process.env): number {
  const value = Number(env.FE_SEN);
  if (!env.FE_SEN || !Number.isFinite(value) || value <= 0) {
    throw new Error("Define FE_SEN (kg CO2/kWh) en el entorno");
  }
  return value;
}

/** Impacto de un recibo: kWh → CO₂ con FE_SEN; el agua se guarda en m³. */
export function billImpact(kind: "ELECTRICITY" | "WATER", saved: number, feSen: number): ImpactData {
  if (kind === "ELECTRICITY") return { kwh: saved, co2Kg: round(saved * feSen, 3) };
  return { m3: saved };
}

/** Litros a partir de m³ (para mostrar). */
export function litersFromM3(m3: number): number {
  return round(m3 * 1000, 1);
}
