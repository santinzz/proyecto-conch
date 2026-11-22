import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ImpactChart } from "@/components/impact-chart";
import { ImpactTiles } from "@/components/impact-tiles";
import { Card, CardContent } from "@/components/ui/card";
import { toChartWeeks } from "@/lib/chart-weeks";
import { db } from "@/lib/db";
import { pilotImpact } from "@/lib/impact-stats";

export const metadata: Metadata = {
  title: "Impacto del piloto",
  description: "Lo que la comunidad de EcoPuntos ha ahorrado y evitado durante el piloto.",
};

// Página pública (sin sesión) para proyectar en la presentación. Solo totales, sin datos personales.
export default async function ImpactoPilotoPage() {
  await connection(); // siempre con los datos del momento, nunca en el build
  const { totals, weekly, participants, activeThisWeek } = await pilotImpact(db);

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-bold text-primary">
            🌱 EcoPuntos
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:underline">
            Entrar
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Impacto del piloto</h1>
          <p className="text-sm text-muted-foreground">
            Lo que la comunidad de EcoPuntos ha ahorrado y evitado, medido con recibos, ventas del stand y reciclaje
            confirmados.
          </p>
        </div>
        <ImpactTiles
          totals={totals}
          extra={[{ label: `personas participando (${activeThisWeek} esta semana)`, value: String(participants) }]}
        />
        <Card>
          <CardContent>
            <ImpactChart weeks={toChartWeeks(weekly)} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
