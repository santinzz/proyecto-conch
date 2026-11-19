import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getBalance } from "@/lib/points/balance";

export default async function InicioPage() {
  // Cada página revisa la sesión por su cuenta (no basta con el layout).
  const user = await requireUser();
  const balance = await getBalance(user.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Hola, {user.name.split(" ")[0]}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Tu saldo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-primary">
            {balance.toLocaleString("es-MX")} <span className="text-lg font-medium">puntos</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Nivel, retos y movimientos llegarán en las siguientes fases.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
