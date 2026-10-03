import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldBoxClasses, floatingLabelClasses } from "./Input";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

/**
 * Misma caja que `Input`, con la etiqueta siempre arriba: un select siempre
 * muestra una opción, nunca está "vacío". `appearance-none` saca la flecha
 * nativa (distinta en cada teléfono) y se dibuja la de lucide.
 */
export function Select({
  label,
  id,
  className,
  children,
  ...props
}: SelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        className={cn(
          fieldBoxClasses,
          "cursor-pointer appearance-none pr-10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <label htmlFor={id} className={floatingLabelClasses}>
        {label}
      </label>
      <ChevronDown
        aria-hidden="true"
        size={16}
        strokeWidth={2}
        className="text-muted pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2"
      />
    </div>
  );
}
