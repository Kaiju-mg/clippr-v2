"use client";

import { useState } from "react";
import { Minus, Package, Plus } from "lucide-react";
import { tileClasses } from "@/components/ui/Tile";
import { cn } from "@/lib/utils";
import { TransactionInlineForm } from "./TransactionInlineForm";
import { SellProductForm } from "./SellProductForm";
import type { Product } from "@/types";

type Panel = "income" | "expense" | "product";

interface CashActionsBentoProps {
  /** Solo productos activos. Vacío si el catálogo no cargó. */
  products: Product[];
}

const ACTIONS = [
  { panel: "income", label: "Ingreso", icon: Plus, tint: "text-success" },
  { panel: "expense", label: "Egreso", icon: Minus, tint: "text-danger" },
  {
    panel: "product",
    label: "Vender",
    icon: Package,
    tint: "text-accent-ink",
  },
] as const satisfies ReadonlyArray<{
  panel: Panel;
  label: string;
  icon: typeof Plus;
  tint: string;
}>;

/**
 * Los tres cubos de acción de la caja. Sólo maneja qué panel está abierto:
 * la lógica de cada movimiento sigue viviendo en los formularios de la
 * spec 07 (`TransactionInlineForm`, `SellProductForm`), que ahora se
 * abren desde acá en vez de traer su propio botón.
 *
 * El formulario se despliega debajo de la grilla, in-line y sin modal
 * (mismo criterio que la agenda y el cierre de caja).
 */
export function CashActionsBento({ products }: CashActionsBentoProps) {
  const [panel, setPanel] = useState<Panel | null>(null);

  function toggle(next: Panel) {
    setPanel((current) => (current === next ? null : next));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {ACTIONS.map(({ panel: value, label, icon: Icon, tint }) => {
          const isOpen = panel === value;
          // Sin productos activos no hay nada que vender: el cubo queda
          // deshabilitado en vez de abrir un formulario con un select vacío.
          const isDisabled = value === "product" && products.length === 0;

          return (
            <button
              key={value}
              type="button"
              aria-pressed={isOpen}
              disabled={isDisabled}
              onClick={() => toggle(value)}
              className={tileClasses(
                "default",
                cn(
                  "flex-col items-center justify-center gap-2 py-4 transition-transform duration-100 active:scale-95",
                  isOpen && "border-accent",
                  isDisabled && "opacity-50",
                ),
              )}
            >
              <Icon size={20} strokeWidth={1.75} className={tint} />
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {(panel === "income" || panel === "expense") && (
        <TransactionInlineForm type={panel} onClose={() => setPanel(null)} />
      )}

      {panel === "product" && (
        <SellProductForm products={products} onClose={() => setPanel(null)} />
      )}
    </div>
  );
}
