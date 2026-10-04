"use client";

import { useState, type FormEvent } from "react";
import { deleteAccountAction } from "@/actions/account.actions";
import { Input } from "@/components/ui/Input";

interface DeleteAccountFormProps {
  /** Lo que hay que escribir: "ELIMINAR" o el nombre de la barbería. */
  expected: string;
  /** Cómo se le pide: "Escribí ELIMINAR" / "Escribí el nombre de tu barbería". */
  label: string;
}

function normalizar(texto: string): string {
  return texto.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

/**
 * Confirmación de "Eliminar mi cuenta". El botón se habilita recién cuando
 * lo escrito coincide: un toque no alcanza para borrar algo que no se puede
 * recuperar. El servidor vuelve a comprobarlo (`deleteAccountAction`).
 */
export function DeleteAccountForm({ expected, label }: DeleteAccountFormProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const coincide = normalizar(value) === normalizar(expected);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!coincide) return;
    setBusy(true);
    setError(null);
    // Si sale bien, el servidor redirige a /login y esta pantalla se va.
    const result = await deleteAccountAction(value);
    setBusy(false);
    if (result && !result.success) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        id="delete-confirmation"
        label={label}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!coincide || busy}
        className="border-danger text-danger rounded-[14px] border p-3 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100"
      >
        {busy ? "Eliminando…" : "Eliminar mi cuenta para siempre"}
      </button>
    </form>
  );
}
