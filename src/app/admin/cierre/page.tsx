import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";
import { billFileStats } from "@/lib/admin/users";
import { db } from "@/lib/db";
import { AdminPageHeader } from "../admin-page";
import { PurgeButton } from "./purge-button";

export const metadata: Metadata = { title: "Cierre del piloto" };

const mb = (bytes: number) => (bytes / (1024 * 1024)).toLocaleString("es-MX", { maximumFractionDigits: 1 });

export default async function CierrePage() {
  await requireUser(AREA_ROLES.admin);
  const stats = await billFileStats(db);
  const deletable = stats.files - stats.pending;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Cierre del piloto"
        description="Hazlo en este orden cuando termine el piloto. Lo que se borra no se puede recuperar."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Descarga los datos para el reporte</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Button nativeButton={false} variant="outline" className="h-11" render={<a href="/api/admin/export.csv?tipo=movimientos" />}>
            ⬇️ Movimientos (CSV)
          </Button>
          <Button nativeButton={false} variant="outline" className="h-11" render={<a href="/api/admin/export.csv?tipo=semanas" />}>
            ⬇️ Impacto por semana (CSV)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Termina las revisiones pendientes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {stats.pending === 0
            ? "No hay recibos en revisión. ✅"
            : `Hay ${stats.pending} recibos en revisión: apruébalos o recházalos en Operador → Validar recibos. Sus archivos no se borran mientras sigan pendientes.`}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Borra las fotos y PDF de los recibos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Así lo promete el aviso de privacidad. Se conservan el número de servicio, el periodo, el consumo y los puntos;
            solo se borran los archivos.
          </p>
          <p className="font-medium">
            {deletable === 0
              ? "No hay archivos que borrar."
              : `${deletable} archivos (${mb(stats.bytes)} MB en total) se pueden borrar.`}
          </p>
          <PurgeButton files={deletable} />
        </CardContent>
      </Card>
    </div>
  );
}
