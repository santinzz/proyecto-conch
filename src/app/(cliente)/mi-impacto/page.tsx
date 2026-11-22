import type { Metadata } from "next";
import { ImpactChart } from "@/components/impact-chart";
import { ImpactTiles } from "@/components/impact-tiles";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { toChartWeeks } from "@/lib/chart-weeks";
import { db } from "@/lib/db";
import { userImpact } from "@/lib/impact-stats";

export const metadata: Metadata = { title: "Mi impacto" };

export default async function MiImpactoPage() {
  const user = await requireUser();
  const { totals, weekly } = await userImpact(db, user.id);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Mi impacto</h1>
        <p className="text-sm text-muted-foreground">Lo que has evitado o ahorrado desde que empezaste en el piloto.</p>
      </div>
      <ImpactTiles totals={totals} />
      <Card>
        <CardContent>
          <ImpactChart weeks={toChartWeeks(weekly)} />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        El CO₂ se calcula con los kWh que ahorras en tus recibos aprobados y el factor de emisión del Sistema Eléctrico
        Nacional. Los envases cuentan cada vez que traes el tuyo al stand, y las piezas, cuando el equipo confirma tu
        reciclaje.
      </p>
    </div>
  );
}
