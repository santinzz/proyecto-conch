import Link from "next/link";

/** Encabezado común de las páginas de administración. */
export function AdminPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
        ← Administración
      </Link>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
