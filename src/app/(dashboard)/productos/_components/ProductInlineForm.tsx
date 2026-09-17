"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  createProductAction,
  updateProductAction,
  toggleProductStatusAction,
} from "@/actions/product.actions";
import type { Product } from "@/types";

interface ProductInlineFormProps {
  product: Product | null;
  onCancel: () => void;
  onSaved: () => void;
}

export function ProductInlineForm({
  product,
  onCancel,
  onSaved,
}: ProductInlineFormProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "0");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    product?.low_stock_threshold != null
      ? String(product.low_stock_threshold)
      : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fieldPrefix = product?.id ?? "new";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const payload = {
      name,
      price: Number(price),
      stock: Number(stock),
      // Vacío = sin aviso de stock bajo.
      low_stock_threshold:
        lowStockThreshold.trim() === "" ? null : Number(lowStockThreshold),
    };

    const result = product
      ? await updateProductAction(product.id, payload)
      : await createProductAction(payload);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  async function handleDelete() {
    if (!product) return;

    setError(null);
    setIsLoading(true);

    // Mismo criterio que servicios: "Eliminar" es desactivar, no un DELETE.
    const result = await toggleProductStatusAction(product.id, false);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-2 mx-0.5 mb-3.5 flex flex-col gap-3 rounded-lg p-3.5"
    >
      <Input
        id={`product-name-${fieldPrefix}`}
        label="Nombre"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      <Input
        id={`product-price-${fieldPrefix}`}
        label="Precio (₲)"
        type="number"
        min="1"
        step="1"
        className="tabular-nums"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        required
      />
      <Input
        id={`product-stock-${fieldPrefix}`}
        label="Stock"
        type="number"
        min="0"
        step="1"
        className="tabular-nums"
        value={stock}
        onChange={(event) => setStock(event.target.value)}
        required
      />
      <Input
        id={`product-low-stock-${fieldPrefix}`}
        label="Avisar cuando queden (opcional)"
        type="number"
        min="0"
        step="1"
        className="tabular-nums"
        value={lowStockThreshold}
        onChange={(event) => setLowStockThreshold(event.target.value)}
      />

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {product ? (
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={isLoading}
          >
            Eliminar
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
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
      </div>
    </form>
  );
}
