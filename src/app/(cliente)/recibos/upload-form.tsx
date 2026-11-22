"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_FILE_BYTES } from "@/lib/bills/limits";

type Kind = "ELECTRICITY" | "WATER";

const KINDS: { value: Kind; label: string }[] = [
  { value: "ELECTRICITY", label: "💡 Luz (CFE)" },
  { value: "WATER", label: "💧 Agua" },
];

/** Las fotos del celular pesan varios MB: se reducen a 2000 px y JPEG antes de subirlas. */
const MAX_SIDE = 2000;
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("foto"))), "image/jpeg", 0.85),
  );
}

export function UploadForm() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("ELECTRICITY");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setError(undefined);
    setPending(true);
    try {
      let upload: Blob = file;
      let name = file.name;
      if (file.type.startsWith("image/")) {
        try {
          upload = await compressImage(file);
          name = "recibo.jpg";
        } catch {
          // Si el navegador no puede abrir la foto, se manda tal cual.
        }
      }
      if (upload.size > MAX_FILE_BYTES) {
        setError("El archivo pesa más de 4 MB. Toma la foto otra vez o sube el PDF.");
        return;
      }
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", upload, name);
      const res = await fetch("/api/bills", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo subir el recibo");
        return;
      }
      router.push(`/recibos/${data.id}`);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">¿De qué es el recibo?</legend>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <Button
                  key={k.value}
                  type="button"
                  variant={kind === k.value ? "default" : "outline"}
                  className="h-11"
                  aria-pressed={kind === k.value}
                  onClick={() => setKind(k.value)}
                >
                  {k.label}
                </Button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="bill-file">Foto o PDF del recibo</Label>
            <Input
              id="bill-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,image/*"
              className="h-11 py-2"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Que se lean bien el número de servicio, el periodo y el consumo. El PDF del recibo en línea es lo
              que mejor funciona.
            </p>
          </div>

          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            🔒 Tu recibo solo lo ven tú y el equipo que valida. Guardamos el número de servicio, el periodo y el
            consumo; la foto o el PDF se borran al terminar el piloto.
          </p>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="h-12 w-full text-base" disabled={!file || pending}>
            {pending ? "Leyendo tu recibo…" : "Subir y leer recibo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
