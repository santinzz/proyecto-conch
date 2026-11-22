"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Values = { serviceNumber: string; periodStart: string; periodEnd: string; consumption: string };

export function ConfirmForm({
  billId,
  kind,
  unit,
  initial,
  readByOcr,
}: {
  billId: string;
  kind: "ELECTRICITY" | "WATER";
  unit: string;
  initial: Values;
  /** Campos que vienen del OCR (para avisar que hay que revisarlos). */
  readByOcr: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const set = (field: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      const res = await fetch(`/api/bills/${billId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, consumption: Number(values.consumption) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo enviar el recibo");
        return;
      }
      router.refresh();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {readByOcr
          ? "Esto es lo que leímos de tu recibo. Revísalo y corrige lo que haga falta."
          : "No pudimos leer el recibo: escribe los datos tal como aparecen en él."}
      </p>

      <div className="space-y-2">
        <Label htmlFor="serviceNumber">{kind === "ELECTRICITY" ? "Número de servicio (12 dígitos)" : "Número de cuenta o contrato"}</Label>
        <Input
          id="serviceNumber"
          required
          inputMode={kind === "ELECTRICITY" ? "numeric" : "text"}
          autoComplete="off"
          className="h-11"
          value={values.serviceNumber}
          onChange={set("serviceNumber")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="periodStart">Periodo: desde</Label>
          <Input id="periodStart" type="date" required className="h-11" value={values.periodStart} onChange={set("periodStart")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodEnd">hasta</Label>
          <Input id="periodEnd" type="date" required className="h-11" value={values.periodEnd} onChange={set("periodEnd")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="consumption">Consumo del periodo ({unit})</Label>
        <Input
          id="consumption"
          type="number"
          required
          min={0}
          step="any"
          inputMode="decimal"
          className="h-11"
          value={values.consumption}
          onChange={set("consumption")}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Enviando…" : "Confirmar y enviar a validación"}
      </Button>
    </form>
  );
}
