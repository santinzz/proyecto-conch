"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "CUSTOMER" | "OPERATOR" | "ADMIN";
const ROLES: { value: Role; label: string }[] = [
  { value: "CUSTOMER", label: "Cliente" },
  { value: "OPERATOR", label: "Operador" },
  { value: "ADMIN", label: "Admin" },
];

export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: Role;
  balance: number;
  joined: string;
  isSelf: boolean;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export function UserRow({ user }: { user: UserSummary }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(user.role);
  const [adjusting, setAdjusting] = useState(false);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  async function send(url: string, method: "PATCH" | "POST", body: unknown, okText: (data: { balance?: number }) => string) {
    setPending(true);
    setMessage(undefined);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "No se pudo guardar" });
        return false;
      }
      setMessage({ ok: true, text: okText(data) });
      router.refresh();
      return true;
    } catch {
      setMessage({ ok: false, text: "Sin conexión. Intenta de nuevo." });
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <p className="font-medium">
            {user.name} {user.isSelf && <span className="text-xs text-muted-foreground">(tú)</span>}
          </p>
          <p className="text-xs break-all text-muted-foreground">
            {user.email} · {user.balance} puntos · desde {user.joined}
          </p>
        </div>

        {!user.isSelf && (
          <div className="flex gap-2">
            <select
              aria-label={`Rol de ${user.name}`}
              className={fieldClass}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="h-11 shrink-0"
              disabled={pending || role === user.role}
              onClick={() => send(`/api/admin/users/${user.id}`, "PATCH", { role }, () => "Rol actualizado")}
            >
              Guardar rol
            </Button>
            <Button variant="outline" className="h-11 shrink-0" onClick={() => setAdjusting((a) => !a)}>
              Ajustar puntos
            </Button>
          </div>
        )}

        {adjusting && (
          <form
            className="space-y-2 rounded-lg border p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await send(
                `/api/admin/users/${user.id}/adjust`,
                "POST",
                { points: Number(points), reason },
                (data) => `Ajuste guardado. Saldo nuevo: ${data.balance} puntos`,
              );
              if (ok) {
                setPoints("");
                setReason("");
                setAdjusting(false);
              }
            }}
          >
            <div className="grid grid-cols-[7rem_1fr] gap-2">
              <div className="space-y-1">
                <Label htmlFor={`pts-${user.id}`}>Puntos</Label>
                <Input
                  id={`pts-${user.id}`}
                  className="h-11"
                  type="number"
                  step={1}
                  required
                  placeholder="+50 o -20"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`why-${user.id}`}>Motivo</Label>
                <Input
                  id={`why-${user.id}`}
                  className="h-11"
                  required
                  minLength={5}
                  maxLength={200}
                  placeholder="Ej.: ticket que no se pudo escanear"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "Guardando…" : "Guardar ajuste"}
            </Button>
          </form>
        )}

        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-primary" : "text-destructive"}`}>
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
