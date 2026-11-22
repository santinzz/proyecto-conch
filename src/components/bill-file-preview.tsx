import { Button } from "@/components/ui/button";

/** Foto o PDF del recibo, servido por /api/bills/:id/file (revisa permisos). */
export function BillFilePreview({ billId, mimeType }: { billId: string; mimeType: string }) {
  const src = `/api/bills/${billId}/file`;
  if (mimeType === "application/pdf") {
    return (
      <Button nativeButton={false} variant="outline" className="h-11 w-full" render={<a href={src} target="_blank" rel="noopener" />}>
        📄 Abrir el PDF del recibo
      </Button>
    );
  }
  return (
    <a href={src} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border">
      {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado: no pasa por el optimizador de imágenes */}
      <img src={src} alt="Foto del recibo" className="max-h-[480px] w-full object-contain" />
    </a>
  );
}
