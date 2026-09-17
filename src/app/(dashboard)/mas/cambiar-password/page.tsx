"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { changePasswordAction } from "@/actions/auth.actions";

/**
 * Cambio de contraseña opcional (no forzado en el primer login): el barbero
 * entra con la temporal que le pasó el dueño y, si quiere, la cambia acá.
 * Ver docs/decisiones.md.
 */
export default function CambiarPasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setIsLoading(true);
    const result = await changePasswordAction({ currentPassword, newPassword });
    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDone(true);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Link href="/mas" className="text-muted flex items-center gap-1 text-sm">
        <ChevronLeft size={16} />
        Más
      </Link>
      <h1 className="font-display text-xl font-semibold">Cambiar contraseña</h1>

      {done ? (
        <p role="status" className="text-foreground text-sm">
          Listo, tu contraseña se cambió. La próxima vez entrá con la nueva.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            id="current-password"
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
          <Input
            id="new-password"
            label="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <Input
            id="confirm-password"
            label="Repetí la contraseña nueva"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isLoading} className="py-3">
            {isLoading ? "Guardando..." : "Cambiar contraseña"}
          </Button>
        </form>
      )}
    </div>
  );
}
