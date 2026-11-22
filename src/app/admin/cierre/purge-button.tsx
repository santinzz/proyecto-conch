"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Borrado definitivo: hay que escribir BORRAR para confirmar. */
export function PurgeButton({ files }: { files: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  async function purge() {
    setPending(true);
    setMessage(undefined);
    try {
      const res = await fetch("/api/admin/bill-files/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMessage({ ok: false, text: data.error ?? "No se pudo borrar" });
      else {
        setMessage({ ok: true, text: `Se borraron ${data.deleted} archivos.` });
        setConfirm("");
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: "Sin conexión. Intenta de nuevo." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="purge-confirm">Escribe BORRAR para confirmar</Label>
      <div className="flex gap-2">
        <Input
          id="purge-confirm"
          className="h-11 font-mono"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button variant="destructive" className="h-11 shrink-0" disabled={pending || confirm !== "BORRAR" || files === 0} onClick={purge}>
          {pending ? "Borrando…" : "Borrar archivos"}
        </Button>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-primary" : "text-destructive"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
