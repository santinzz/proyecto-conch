import type { Metadata } from "next";
import Link from "next/link";
import { ImpactChart } from "@/components/impact-chart";
import { ImpactTiles } from "@/components/impact-tiles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { toChartWeeks } from "@/lib/chart-weeks";
import { db } from "@/lib/db";
import { formatMXN, formatPoints } from "@/lib/format";
import { adminMetrics } from "@/lib/impact-stats";

export const metadata: Metadata = { title: "Administración" };

const SECTIONS = [
  { href: "/admin/productos", emoji: "🧴", title: "Catálogo" },
  { href: "/admin/reglas", emoji: "⚖️", title: "Reglas de puntos" },
  { href: "/admin/retos", emoji: "🏆", title: "Retos" },
  { href: "/admin/recompensas", emoji: "🎁", title: "Recompensas" },
  { href: "/admin/contenedores", emoji: "♻️", title: "Contenedores" },
];

export default async function AdminPage() {
  await requireUser(AREA_ROLES.admin);
  const m = await adminMetrics(db);
  const stats = [
    { label: "personas participando", value: String(m.participants) },
    { label: "activas esta semana", value: String(m.activeThisWeek) },
    { label: "clientes registrados", value: String(m.users.customers) },
    { label: "puntos ganados", value: formatPoints(m.pointsEarned) },
    { label: "puntos canjeados o donados", value: formatPoints(m.pointsSpent) },
    { label: `ventas del stand (${formatMXN(m.sales.totalCents)})`, value: String(m.sales.count) },
    { label: `cupones (${m.coupons.used} entregados)`, value: String(m.coupons.issued) },
    { label: "árboles donados", value: String(m.trees) },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Administración</h1>

      {(m.pending.bills > 0 || m.pending.recycle > 0) && (
        <Link href="/operador" className="block rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          ⏳ Pendientes: {m.pending.bills} recibos y {m.pending.recycle} solicitudes de reciclaje →
        </Link>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label} className="rounded-xl border bg-card p-3">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </li>
        ))}
      </ul>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impacto del piloto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImpactTiles totals={m.impact} />
          <ImpactChart weeks={toChartWeeks(m.weekly)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exportar para el reporte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button nativeButton={false} variant="outline" className="h-11" render={<a href="/api/admin/export.csv?tipo=movimientos" />}>
              ⬇️ Movimientos (CSV)
            </Button>
            <Button nativeButton={false} variant="outline" className="h-11" render={<a href="/api/admin/export.csv?tipo=semanas" />}>
              ⬇️ Impacto por semana (CSV)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cada persona aparece con un seudónimo (U-…), sin nombre ni correo. La página pública para la presentación está
            en{" "}
            <Link href="/impacto" className="text-primary underline-offset-4 hover:underline">
              /impacto
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>
                  {s.emoji}
                </span>
                <span className="font-medium">{s.title}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
