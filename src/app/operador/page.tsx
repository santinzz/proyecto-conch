import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AREA_ROLES, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Operador" };

const SECTIONS = [
  { href: "/operador/caja", emoji: "🧾", title: "Caja", desc: "Arma la venta y genera el QR del ticket", ready: true },
  { href: "#", emoji: "💡", title: "Validar recibos", desc: "Llega en la Fase 4", ready: false },
  { href: "#", emoji: "♻️", title: "Validar reciclaje", desc: "Llega en la Fase 5", ready: false },
];

export default async function OperadorPage() {
  await requireUser(AREA_ROLES.operador);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Operador</h1>
      <div className="grid gap-3">
        {SECTIONS.map((s) => {
          const body = (
            <Card className={s.ready ? "transition-colors hover:bg-muted/50" : "opacity-60"}>
              <CardContent className="flex items-center gap-4">
                <span className="text-3xl">{s.emoji}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </CardContent>
            </Card>
          );
          return s.ready ? (
            <Link key={s.title} href={s.href}>
              {body}
            </Link>
          ) : (
            <div key={s.title} aria-disabled>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
