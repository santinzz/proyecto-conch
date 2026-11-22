"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "number" | "money" | "boolean" | "select" | "datetime";
  options?: { value: string; label: string }[];
  nullable?: boolean; // vacío = sin valor (p. ej. "sin límite")
  help?: string;
};
export type FieldValue = string | number | boolean | null;
export type ManagedItem = { id: string; title: string; subtitle: string; values: Record<string, FieldValue> };

type FormState = Record<string, string | boolean>;

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO → valor de <input type="datetime-local"> en la hora del navegador. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toForm(fields: FieldDef[], values?: Record<string, FieldValue>): FormState {
  const state: FormState = {};
  for (const f of fields) {
    const v = values?.[f.name] ?? null;
    if (f.type === "boolean") state[f.name] = v === true;
    else if (v === null) state[f.name] = "";
    else if (f.type === "money") state[f.name] = (Number(v) / 100).toFixed(2);
    else if (f.type === "datetime") state[f.name] = toLocalInput(String(v));
    else state[f.name] = String(v);
  }
  return state;
}

function fromForm(fields: FieldDef[], state: FormState): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const f of fields) {
    const v = state[f.name];
    if (f.type === "boolean") out[f.name] = v === true;
    else if (v === "" && f.nullable) out[f.name] = null;
    else if (f.type === "number") out[f.name] = Number(v);
    else if (f.type === "money") out[f.name] = Math.round(Number(v) * 100);
    else if (f.type === "datetime") out[f.name] = v ? new Date(String(v)).toISOString() : "";
    else out[f.name] = String(v);
  }
  return out;
}

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

function EntityForm({
  entity,
  fields,
  item,
  onDone,
}: {
  entity: string;
  fields: FieldDef[];
  item?: ManagedItem;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => toForm(fields, item?.values));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      const res = await fetch(item ? `/api/admin/${entity}/${encodeURIComponent(item.id)}` : `/api/admin/${entity}`, {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fromForm(fields, state)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      {fields.map((f) => {
        const id = `${entity}-${item?.id ?? "nuevo"}-${f.name}`;
        const value = state[f.name];
        const set = (v: string | boolean) => setState((s) => ({ ...s, [f.name]: v }));
        if (f.type === "boolean") {
          return (
            <label key={f.name} htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm">
              <input id={id} type="checkbox" className="size-5" checked={value === true} onChange={(e) => set(e.target.checked)} />
              {f.label}
            </label>
          );
        }
        return (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={id}>{f.label}</Label>
            {f.type === "select" ? (
              <select id={id} className={fieldClass} value={String(value)} onChange={(e) => set(e.target.value)}>
                {f.nullable && <option value="">—</option>}
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={id}
                className="h-11"
                type={f.type === "datetime" ? "datetime-local" : f.type === "text" ? "text" : "number"}
                step={f.type === "money" ? "0.01" : f.type === "number" ? "any" : undefined}
                min={f.type === "money" || f.type === "number" ? 0 : undefined}
                required={!f.nullable}
                value={String(value)}
                onChange={(e) => set(e.target.value)}
              />
            )}
            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
          </div>
        );
      })}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

/** Lista con edición en la misma tarjeta y, si se permite, alta de registros nuevos. */
export function EntityManager({
  entity,
  fields,
  items,
  canCreate,
  createLabel = "Agregar",
}: {
  entity: string;
  fields: FieldDef[];
  items: ManagedItem[];
  canCreate: boolean;
  createLabel?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {canCreate &&
        (editing === "nuevo" ? (
          <Card>
            <CardContent>
              <EntityForm entity={entity} fields={fields} onDone={() => setEditing(null)} />
            </CardContent>
          </Card>
        ) : (
          <Button className="h-11 w-full" onClick={() => setEditing("nuevo")}>
            + {createLabel}
          </Button>
        ))}
      {items.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Todavía no hay registros.</p>}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                  {editing !== item.id && (
                    <Button variant="outline" className="h-9 shrink-0" onClick={() => setEditing(item.id)}>
                      Editar
                    </Button>
                  )}
                </div>
                {editing === item.id && (
                  <EntityForm entity={entity} fields={fields} item={item} onDone={() => setEditing(null)} />
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
