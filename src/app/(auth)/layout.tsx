export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="font-heading text-4xl font-extrabold tracking-tight text-primary">EcoPuntos</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">Junta puntos comprando a granel, trayendo tu envase y ahorrando luz y agua.</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <a href="/privacidad" className="mt-4 inline-flex min-h-11 items-center text-xs text-muted-foreground hover:underline">
        Aviso de privacidad
      </a>
    </main>
  );
}
