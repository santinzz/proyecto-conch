export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-3xl font-bold text-primary">🌱 EcoPuntos</p>
        <p className="mt-1 text-sm text-muted-foreground">Puntos por cuidar el planeta</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <a href="/privacidad" className="mt-4 inline-flex min-h-11 items-center text-xs text-muted-foreground hover:underline">
        Aviso de privacidad
      </a>
    </main>
  );
}
