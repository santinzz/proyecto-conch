import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPoints } from "@/lib/format";
import { getBalance } from "@/lib/points/balance";
import { CouponQr } from "./coupon-qr";
import { RedeemButton } from "./redeem-button";

export const metadata: Metadata = { title: "Canjear" };

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

export default async function CanjearPage() {
  const user = await requireUser();
  const [balance, rewards, redemptions] = await Promise.all([
    getBalance(user.id),
    db.reward.findMany({ orderBy: [{ isDonation: "asc" }, { cost: "asc" }] }),
    db.redemption.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { reward: { select: { name: true, isDonation: true } } },
    }),
  ]);
  const coupons = redemptions.filter((r) => !r.reward.isDonation);
  const trees = redemptions.filter((r) => r.reward.isDonation).length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Canjear</h1>
        <p className="text-sm text-muted-foreground">
          Tienes <span className="font-semibold text-primary">{formatPoints(balance)} puntos</span>. 100 puntos equivalen a
          $10 de referencia.
        </p>
      </div>

      <ul className="space-y-3">
        {rewards.map((r) => {
          const disabledReason = r.stock <= 0 ? "Agotado" : balance < r.cost ? `Te faltan ${formatPoints(r.cost - balance)} puntos` : null;
          return (
            <li key={r.id}>
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl" aria-hidden>
                      {r.isDonation ? "🌳" : "🎁"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.isDonation ? "Donación" : `Quedan ${r.stock}`} · {formatPoints(r.cost)} puntos
                      </p>
                    </div>
                  </div>
                  <RedeemButton rewardId={r.id} cost={r.cost} isDonation={r.isDonation} disabledReason={disabledReason} />
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mis cupones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {trees > 0 && (
            <p className="rounded-lg bg-primary/10 p-3 text-sm">
              🌳 Has donado {trees} {trees === 1 ? "árbol" : "árboles"}. ¡Gracias!
            </p>
          )}
          {coupons.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">Aún no tienes cupones.</p>
          ) : (
            <ul className="space-y-4">
              {coupons.map((c) => (
                <li key={c.id} className={`rounded-lg border p-4 text-center ${c.usedAt ? "opacity-60" : ""}`}>
                  <p className="font-medium">{c.reward.name}</p>
                  {c.usedAt ? (
                    <p className="text-sm text-muted-foreground">Usado el {dateFmt.format(c.usedAt)}</p>
                  ) : (
                    <>
                      <CouponQr code={c.code} />
                      <p className="font-mono text-lg font-semibold tracking-wider">{c.code}</p>
                      <p className="text-xs text-muted-foreground">Muéstralo en el stand. Vale hasta el fin del piloto.</p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
