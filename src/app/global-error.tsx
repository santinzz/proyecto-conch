"use client";

// Reemplaza al layout raíz si este falla: no lleva los estilos globales, por eso usa estilos en línea.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <title>Algo salió mal · EcoPuntos</title>
        <main style={{ maxWidth: 360, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 48, margin: 0 }}>⚠️</p>
          <h1 style={{ fontSize: 20 }}>Algo salió mal</h1>
          <p style={{ color: "#5b6b5b" }}>EcoPuntos no pudo cargar. Intenta de nuevo en un momento.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 48, width: "100%", border: 0, borderRadius: 12, background: "#2f855a", color: "#fff", fontSize: 16, fontWeight: 600 }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
