import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import type { SessionUser } from "@/lib/auth/session";

const ROLE_LABEL = { CUSTOMER: "Cliente", OPERATOR: "Operador", ADMIN: "Admin" } as const;

export function AppHeader({ user }: { user: SessionUser }) {
  const links = [{ href: "/", label: "Inicio" }];
  if (user.role === "OPERATOR" || user.role === "ADMIN") links.push({ href: "/operador", label: "Operador" });
  if (user.role === "ADMIN") links.push({ href: "/admin", label: "Admin" });

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="shrink-0 font-bold whitespace-nowrap text-primary">
          🌱 EcoPuntos
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="truncate text-muted-foreground">
            {user.name} · {ROLE_LABEL[user.role]}
          </span>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </div>
      {links.length > 1 && (
        <nav className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-4 pb-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full border px-3 py-1 text-sm whitespace-nowrap hover:bg-muted"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
