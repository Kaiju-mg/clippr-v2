"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { sellProductAction } from "@/actions/cash.actions";
import { formatGuaranies } from "@/lib/utils";
import type { Product } from "@/types";

interface SellProductFormProps {
  /** Solo productos activos. */
  products: Product[];
}

/**
 * Venta rápida de un producto. El total que se muestra es orientativo: el
 * monto que entra en la caja lo calcula `sellProductAction` con el precio
 * de la base, y ahí también se valida el stock.
 */
export function SellProductForm({ products }: SellProductFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const firstInStock = products.find((product) => product.stock > 0);
  const [productId, setProductId] = useState(firstInStock?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selected = products.find((product) => product.id === productId);
  const quantityNumber = Number(quantity);
  const total =
    selected && Number.isInteger(quantityNumber) && quantityNumber > 0
      ? selected.price * quantityNumber
      : null;

  function close() {
    setIsOpen(false);
    setError(null);
    setQuantity("1");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await sellProductAction({
      productId,
      quantity: quantityNumber,
    });

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      router.refresh();
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
        Vender producto
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3.5"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="sell-product" className="text-sm font-medium text-muted">
          Producto
        </label>
        <select
          id="sell-product"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          className="rounded border border-line bg-background px-3 py-2 text-foreground"
          required
        >
          <option value="" disabled>
            Elegí un producto
          </option>
          {products.map((product) => (
            <option
              key={product.id}
              value={product.id}
              disabled={product.stock === 0}
            >
              {`${product.name} — ${formatGuaranies(product.price)} (${
                product.stock === 0 ? "sin stock" : `quedan ${product.stock}`
              })`}
            </option>
          ))}
        </select>
      </div>

      <Input
        id="sell-quantity"
        label="Cantidad"
        type="number"
        min="1"
        step="1"
        className="tabular-nums"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        required
      />

      {total !== null && (
        <p className="flex justify-between text-sm">
          <span className="text-muted">Total</span>
          <span className="font-semibold tabular-nums">
            {formatGuaranies(total)}
          </span>
        </p>
      )}

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
        <Button type="submit" disabled={isLoading || !productId}>
          {isLoading ? "Vendiendo..." : "Vender"}
        </Button>
      </div>
    </form>
  );
}
