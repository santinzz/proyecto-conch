"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string };

/** Pestañas del encabezado; la sección actual se marca con una línea nopal. */
export function AppNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav aria-label="Secciones" className="mx-auto flex max-w-2xl gap-4 overflow-x-auto px-4">
      {links.map((l) => {
        const active = isActive(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center border-b-2 text-sm whitespace-nowrap transition-colors ${
              active ? "border-primary font-bold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
