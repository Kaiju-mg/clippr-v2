"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAmountInput } from "@/components/forms/useAmountInput";
import { registerTransactionAction } from "@/actions/cash.actions";
import type { TransactionType } from "@/types";

/**
 * Ingreso o egreso manual en la caja abierta (ej. comprar café). Acordeón
 * in-line, sin modal. El monto viaja como entero: la máscara con puntos de
 * miles es solo visual (useAmountInput). La caja la resuelve el servidor.
 */
export function TransactionInlineForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<TransactionType>("expense");
  const amount = useAmountInput();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function close() {
    setIsOpen(false);
    setError(null);
    setType("expense");
    setDescription("");
    amount.reset();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await registerTransactionAction({
      type,
      amount: Number(amount.digits),
      description,
    });

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    close();
    router.refresh();
  }

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={() => setIsOpen(true)}
        className="w-full py-3"
      >
        Movimiento manual
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3.5"
    >
      <div
        role="group"
        aria-label="Tipo de movimiento"
        className="grid grid-cols-2 gap-1 rounded bg-background p-1"
      >
        {(
          [
            { value: "expense", label: "Egreso" },
            { value: "income", label: "Ingreso" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={type === option.value}
            onClick={() => setType(option.value)}
            className={`rounded py-2 text-sm font-medium transition-colors ${
              type === option.value
                ? "bg-accent text-white"
                : "text-muted"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="transaction-amount"
          className="text-sm font-medium text-muted"
        >
          Monto (Gs.)
        </label>
        <input
          id="transaction-amount"
          type="text"
          inputMode="numeric"
          required
          value={amount.formatted}
          onChange={amount.handleChange}
          placeholder="0"
          className="rounded border border-line bg-background px-3 py-2 tabular-nums text-foreground"
        />
      </div>

      <Input
        id="transaction-description"
        label="Descripción"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder={type === "expense" ? "Ej. café" : "Ej. propina"}
        required
      />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={close}
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
