"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Stamp } from "@/components/ui/Stamp";
import { Switch } from "@/components/ui/Switch";
import { ProductInlineForm } from "./ProductInlineForm";
import { toggleProductStatusAction } from "@/actions/product.actions";
import { formatGuaranies } from "@/lib/utils";
import type { Product } from "@/types";
import { BlankTicket } from "@/components/ticket/BlankTicket";
import { catalogSummary } from "@/lib/catalog-summary";

interface ProductListProps {
  products: Product[];
  /** Solo el dueño ve los controles de edición (spec 07). */
  isOwner: boolean;
}

interface ToggleAction {
  id: string;
  isActive: boolean;
}

function isLowStock(product: Product): boolean {
  return (
    product.low_stock_threshold !== null &&
    product.stock <= product.low_stock_threshold
  );
}

/** Mismos patrones que ServiceList: fila expandible y switch optimista. */
export function ProductList({ products, isOwner }: ProductListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [optimisticProducts, applyOptimisticToggle] = useOptimistic(
    products,
    (state: Product[], action: ToggleAction) =>
      state.map((product) =>
        product.id === action.id
          ? { ...product, is_active: action.isActive }
          : product,
      ),
  );

  function closeForms() {
    setIsCreating(false);
    setEditingId(null);
  }

  function toggleCreate() {
    setError(null);
    setEditingId(null);
    setIsCreating((current) => !current);
  }

  function toggleEdit(id: string) {
    setError(null);
    setIsCreating(false);
    setEditingId((current) => (current === id ? null : id));
  }

  function handleSaved() {
    closeForms();
    router.refresh();
  }

  function handleToggleActive(product: Product) {
    const nextActive = !product.is_active;
    setError(null);

    startTransition(async () => {
      applyOptimisticToggle({ id: product.id, isActive: nextActive });

      const result = await toggleProductStatusAction(product.id, nextActive);
      if (!result.success) {
        setError(result.error);
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Productos</h1>
        {isOwner && (
          <Button
            onClick={toggleCreate}
            variant={isCreating ? "secondary" : "primary"}
          >
            {isCreating ? "Cancelar" : "Nuevo producto"}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      {isCreating && (
        <ProductInlineForm
          product={null}
          onCancel={closeForms}
          onSaved={handleSaved}
        />
      )}

      {optimisticProducts.length === 0 && !isCreating ? (
        <BlankTicket text="Todavía no hay productos cargados." />
      ) : (
        <>
          <p className="text-muted font-mono text-xs tabular-nums">
            {catalogSummary({
              active: optimisticProducts.filter((p) => p.is_active).length,
              paused: optimisticProducts.filter((p) => !p.is_active).length,
              soldOut: optimisticProducts.filter((p) => p.stock === 0).length,
            })}
          </p>
          <ul className="flex flex-col">
            {optimisticProducts.map((product) => {
              const isOpen = editingId === product.id;
              const lowStock = isLowStock(product);
              return (
                <li
                  key={product.id}
                  // Punteado: cada fila lleva un precio (spec 10, regla 3).
                  className="border-muted/55 border-b border-dashed last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3 py-3.5">
                    <div
                      className={`flex min-w-0 flex-col gap-1 ${
                        product.is_active ? "" : "opacity-40"
                      }`}
                    >
                      <span className="font-display truncate text-[17px] font-semibold">
                        {product.name}
                      </span>
                      {/* Agotado es algo que ya pasó: sello (spec 10). */}
                      {product.stock === 0 ? (
                        <span className="pt-0.5">
                          <Stamp>Agotado</Stamp>
                        </span>
                      ) : (
                        <span
                          className={`font-mono text-[13px] tabular-nums ${
                            lowStock ? "text-danger" : "text-muted"
                          }`}
                        >
                          {`Stock: ${product.stock}`}
                          {lowStock ? " · Stock bajo" : ""}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-accent-ink font-mono text-[15px] font-semibold whitespace-nowrap tabular-nums ${
                        product.is_active ? "" : "opacity-40"
                      }`}
                    >
                      {formatGuaranies(product.price)}
                    </span>
                    {isOwner && (
                      <div className="flex flex-none items-center gap-2">
                        <Switch
                          checked={product.is_active}
                          onChange={() => handleToggleActive(product)}
                          label={
                            product.is_active
                              ? `Desactivar ${product.name}`
                              : `Activar ${product.name}`
                          }
                        />
                        <button
                          type="button"
                          onClick={() => toggleEdit(product.id)}
                          aria-label={isOpen ? "Cerrar edición" : "Editar"}
                          aria-expanded={isOpen}
                          className={`grid h-8 w-8 place-items-center rounded-md border ${
                            isOpen
                              ? "border-accent text-accent-ink"
                              : "border-line text-muted"
                          }`}
                        >
                          {isOpen ? (
                            <svg
                              viewBox="0 0 20 20"
                              width="15"
                              height="15"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                            >
                              <path d="M5.5 12.5 10 8l4.5 4.5" />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 20 20"
                              width="15"
                              height="15"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M13.3 3.3a1.6 1.6 0 0 1 2.3 2.3L6.4 14.8l-3 .8.8-3Z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    <ProductInlineForm
                      product={product}
                      onCancel={closeForms}
                      onSaved={handleSaved}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
