"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createBarberAction, updateBarberAction } from "@/actions/team.actions";
import type { User, UserLevel } from "@/types";

const NIVELES: { value: UserLevel; label: string }[] = [
  { value: "junior", label: "Junior" },
  { value: "pro", label: "Pro" },
  { value: "senior", label: "Senior" },
  { value: "elite", label: "Elite" },
];

interface BarberInlineFormProps {
  /** null = alta de un barbero nuevo. Un User existente = edición
   * (solo nivel y comisión: no se puede cambiar nombre/correo acá). */
  barber: User | null;
  onCancel: () => void;
  onSaved: () => void;
}

interface CreatedCredentials {
  name: string;
  email: string;
  temporaryPassword: string;
}

export function BarberInlineForm({
  barber,
  onCancel,
  onSaved,
}: BarberInlineFormProps) {
  const [name, setName] = useState(barber?.name ?? "");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<UserLevel>(barber?.level ?? "junior");
  const [commissionPct, setCommissionPct] = useState(
    barber ? String(barber.commission_pct) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Solo vive en memoria mientras se muestra: al tocar "Listo" se pierde y
  // no hay forma de volver a verla (no se guarda en ningún lado).
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  const fieldPrefix = barber?.id ?? "new";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    if (barber) {
      const result = await updateBarberAction(barber.id, {
        level,
        commission_pct: Number(commissionPct),
      });
      setIsLoading(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved();
      return;
    }

    const result = await createBarberAction({
      name,
      email,
      level,
      commission_pct: Number(commissionPct),
    });
    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setCreated({
      name: result.data.barber.name,
      email: email.trim(),
      temporaryPassword: result.data.temporaryPassword,
    });
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.temporaryPassword);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles: la contraseña igual está en pantalla.
    }
  }

  if (created) {
    return (
      <div className="bg-surface-2 mx-0.5 mb-3.5 flex flex-col gap-3 rounded-lg p-3.5">
        <p className="text-foreground text-sm">
          Listo, {created.name} ya puede entrar con{" "}
          <span className="font-medium">{created.email}</span> y esta
          contraseña:
        </p>
        <p
          aria-label="Contraseña temporal"
          className="bg-background border-line rounded border py-3 text-center font-mono text-2xl font-bold tracking-[0.3em] tabular-nums select-all"
        >
          {created.temporaryPassword}
        </p>
        <p className="text-muted text-sm">
          Anotala o pasásela ahora: no se vuelve a mostrar. Después la puede
          cambiar desde Más → Cambiar contraseña.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleCopy}>
            {copied ? "Copiada" : "Copiar"}
          </Button>
          <Button type="button" onClick={onSaved}>
            Listo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-2 mx-0.5 mb-3.5 flex flex-col gap-3 rounded-lg p-3.5"
    >
      {!barber && (
        <>
          <Input
            id={`barber-name-${fieldPrefix}`}
            label="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Input
            id={`barber-email-${fieldPrefix}`}
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </>
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`barber-level-${fieldPrefix}`}
          className="text-muted text-sm font-medium"
        >
          Nivel
        </label>
        <select
          id={`barber-level-${fieldPrefix}`}
          value={level}
          onChange={(event) => setLevel(event.target.value as UserLevel)}
          className="border-line bg-background text-foreground rounded border px-3 py-2"
        >
          {NIVELES.map((nivel) => (
            <option key={nivel.value} value={nivel.value}>
              {nivel.label}
            </option>
          ))}
        </select>
      </div>

      <Input
        id={`barber-commission-${fieldPrefix}`}
        label="Comisión (%)"
        type="number"
        min="0"
        max="100"
        step="1"
        className="tabular-nums"
        value={commissionPct}
        onChange={(event) => setCommissionPct(event.target.value)}
        required
      />

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
