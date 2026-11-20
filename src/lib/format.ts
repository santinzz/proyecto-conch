const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

/** 4550 → "$45.50" */
export function formatMXN(cents: number): string {
  return mxn.format(cents / 100);
}

export function formatPoints(points: number): string {
  return points.toLocaleString("es-MX");
}
