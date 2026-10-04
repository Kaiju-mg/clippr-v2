"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAmountInput } from "@/components/forms/useAmountInput";
import { registerTransactionAction } from "@/actions/cash.actions";
import type { TransactionType } from "@/types";

interface TransactionInlineFormProps {
  /**
   * Ingreso o egreso. Lo decide el cubo que se tocó en la grilla
   * (`CashActionsBento`), no un selector dentro del formulario: el tipo de
   * movimiento es la elección principal y merece un cubo propio.
   */
  type: TransactionType;
  onClose: () => void;
}

/**
 * Ingreso o egreso manual en la caja abierta (ej. comprar café). Acordeón
 * in-line, sin modal. El monto viaja como entero: la máscara con puntos de
 * miles es solo visual (useAmountInput). La caja la resuelve el servidor.
 */
export function TransactionInlineForm({
  type,
  onClose,
}: TransactionInlineFormProps) {
  const router = useRouter();
  const amount = useAmountInput();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

    onClose();
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-2 border-line rounded-tile flex flex-col gap-3 border p-4"
    >
      <p className="text-muted text-[0.625rem] font-medium tracking-[0.14em] uppercase">
        {type === "expense" ? "Nuevo egreso" : "Nuevo ingreso"}
      </p>

      <Input
        id="transaction-amount"
        label="Monto"
        prefix="Gs."
        type="text"
        inputMode="numeric"
        required
        value={amount.formatted}
        onChange={amount.handleChange}
        placeholder="0"
        className="font-mono font-semibold tabular-nums"
      />

      <Input
        id="transaction-description"
        label="Descripción"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder={type === "expense" ? "Ej. café" : "Ej. propina"}
        required
      />

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
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
