import { AppHeader } from "@/components/app-header";
import type { SessionUser } from "@/lib/auth/session";

/** Encabezado + contenido centrado, pensado primero para celular. */
export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
