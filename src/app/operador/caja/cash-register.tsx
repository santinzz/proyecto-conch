"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { EcoBadge } from "@/components/eco-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMXN, formatPoints } from "@/lib/format";
import type { EcoScore } from "@/lib/points/eco-score";

type Product = { id: string; name: string; priceCents: number; ecoScore: EcoScore | null };

type Ticket = {
  saleId: string;
  qr: string;
  expiresAt: string;
  totalCents: number;
  basePoints: number;
  broughtContainer: boolean;
};

type Status = { claimed: boolean; claimedBy: string | null };

export function CashRegister({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [broughtContainer, setBroughtContainer] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, query]);

  const totalCents = products.reduce((sum, p) => sum + (cart[p.id] ?? 0) * p.priceCents, 0);
  const itemCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const canGenerate = itemCount > 0 || broughtContainer;

  function changeQty(id: string, delta: number) {
    setCart((c) => {
      const qty = Math.max(0, Math.min(99, (c[id] ?? 0) + delta));
      const next = { ...c };
      if (qty === 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  async function generate() {
    setError(undefined);
    setPending(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: Object.entries(cart).map(([productId, qty]) => ({ productId, qty })),
          broughtContainer,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo generar el ticket");
        return;
      }
      setTicket(data);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  function newSale() {
    setTicket(null);
    setCart({});
    setBroughtContainer(false);
    setQuery("");
  }

  if (ticket) {
    return <TicketView key={ticket.saleId} ticket={ticket}onNewSale={newSale} onRegenerate={generate} regenerating={pending} />;
  }

  return (
    <div className="space-y-4 pb-44">
      <h1 className="text-xl font-semibold">Caja</h1>
      <Input
        type="search"
        placeholder="Buscar producto…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-11"
        aria-label="Buscar producto"
      />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay productos que coincidan.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {filtered.map((p) => {
            const qty = cart[p.id] ?? 0;
            return (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-heading tabular-nums">{formatMXN(p.priceCents)}</span> <EcoBadge score={p.ecoScore} />
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {qty > 0 && (
                    <>
                      <Button variant="outline" className="size-11 text-lg" onClick={() => changeQty(p.id, -1)} aria-label={`Quitar ${p.name}`}>
                        −
                      </Button>
                      <span className="w-7 text-center font-semibold tabular-nums">{qty}</span>
                    </>
                  )}
                  <Button variant={qty > 0 ? "outline" : "default"} className="size-11 text-lg" onClick={() => changeQty(p.id, 1)} aria-label={`Agregar ${p.name}`}>
                    +
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={broughtContainer}
              onChange={(e) => setBroughtContainer(e.target.checked)}
            />
            <span className="font-medium">♻️ Trajo su bolsa o envase</span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                {itemCount} {itemCount === 1 ? "producto" : "productos"}
              </p>
              <p className="font-heading text-2xl font-bold tabular-nums">{formatMXN(totalCents)}</p>
            </div>
            <Button className="h-12 px-6 text-base" disabled={!canGenerate || pending} onClick={generate}>
              {pending ? "Generando…" : "Generar QR"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketView({
  ticket,
  onNewSale,
  onRegenerate,
  regenerating,
}: {
  ticket: Ticket;
  onNewSale: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [qrImage, setQrImage] = useState<string>();
  const [status, setStatus] = useState<Status>({ claimed: false, claimedBy: null });
  const [now, setNow] = useState(() => Date.now());
  const expiresAt = new Date(ticket.expiresAt).getTime();
  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const expired = secondsLeft === 0 && !status.claimed;

  useEffect(() => {
    QRCode.toDataURL(ticket.qr, { width: 640, margin: 2, errorCorrectionLevel: "M" }).then(setQrImage);
  }, [ticket.qr]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Pregunta cada 2 s si ya lo escanearon, hasta que se reclame o venza.
  useEffect(() => {
    if (status.claimed || expired) return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/sales/${ticket.saleId}`).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        if (data.claimed) setStatus({ claimed: true, claimedBy: data.claimedBy });
      }
    }, 2000);
    return () => clearInterval(id);
  }, [ticket.saleId, status.claimed, expired]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ticket</h1>
      {/* Ticket de papel del stand: borde perforado (clase .ticket en globals.css).
          La sombra va en el contenedor porque la máscara recortaría la del ticket. */}
      <div className="drop-shadow-[0_1px_2px_rgb(23_50_42/0.18)]">
      <div className="ticket bg-white px-5 py-8 text-center text-foreground">
        {status.claimed ? (
          <div className="space-y-2 py-10">
            <p className="font-heading text-3xl font-extrabold text-primary">Escaneado</p>
            <p className="text-lg font-bold">{status.claimedBy ? `Lo canjeó ${status.claimedBy}.` : "Ya se canjeó."}</p>
            <p className="text-sm text-muted-foreground">Los puntos ya están en su cuenta.</p>
          </div>
        ) : expired ? (
          <div className="space-y-2 py-10">
            <p className="font-heading text-3xl font-extrabold">El QR venció</p>
            <p className="text-sm text-muted-foreground">Genera uno nuevo con la misma venta.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pide al cliente que lo escanee desde EcoPuntos</p>
            {qrImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImage} alt="Código QR del ticket" className="mx-auto aspect-square w-full max-w-xs" />
            ) : (
              <div className="mx-auto aspect-square w-full max-w-xs animate-pulse bg-muted" />
            )}
            <p className="text-sm" aria-live="polite">
              Vence en <span className="font-heading text-base font-bold tabular-nums">{mm}:{ss}</span>
            </p>
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2 border-t-2 border-dashed border-border pt-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-heading text-2xl font-bold tabular-nums">{formatMXN(ticket.totalCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Puntos base</p>
            <p className="font-heading text-2xl font-bold tabular-nums">{formatPoints(ticket.basePoints)}</p>
            {ticket.broughtContainer && <p className="text-xs text-muted-foreground">más el envase</p>}
          </div>
        </div>
      </div>
      </div>
      {expired && (
        <Button className="h-12 w-full text-base" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? "Generando…" : "Generar QR de nuevo"}
        </Button>
      )}
      <Button variant={status.claimed ? "default" : "outline"} className="h-12 w-full text-base" onClick={onNewSale}>
        {status.claimed ? "Nueva venta" : "Cancelar y empezar otra venta"}
      </Button>
    </div>
  );
}
