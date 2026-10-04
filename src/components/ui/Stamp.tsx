"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StampSize = "sm" | "md";

const SIZE_CLASSES: Record<StampSize, string> = {
  // Dentro de una fila (COBRADO, AGOTADO, MEJOR DEL MES).
  sm: "-rotate-6 rounded-[4px] border-[1.5px] px-[5px] text-[9.5px] leading-[1.6] tracking-[0.14em]",
  // Suelto, más grande (la racha en el ticket del cierre).
  md: "-rotate-8 rounded-[5px] border-2 px-[7px] py-px text-xs tracking-[0.16em]",
};

interface StampProps {
  children: ReactNode;
  size?: StampSize;
  /**
   * Cae como un sello al aparecer. Se decide **una sola vez, al montar**: si
   * después cambia esta prop o el componente se vuelve a renderizar, el sello
   * no vuelve a caer. Para las filas que ya venían cobradas al cargar la
   * pantalla va en `false`: el golpe es para lo que acaba de pasar.
   */
  animate?: boolean;
  /** Espera antes de caer (el sello de la racha cae después de imprimir). */
  delayMs?: number;
  /** Doble borde, como un sello de goma de verdad. */
  double?: boolean;
  className?: string;
}

/**
 * Sello de tinta roja (spec 10, regla 2): marca algo que **ya pasó** —
 * cobrado, agotado, la racha, el mejor del mes. Nunca un botón ni un error
 * (eso es `--danger`). Toma el color de `--stamp`; adentro del ticket,
 * `TicketReceipt` lo cambia por el rojo claro del papel.
 *
 * Con "reducir movimiento" aparece directamente, sin caer.
 */
export function Stamp({
  children,
  size = "sm",
  animate = false,
  delayMs,
  double = false,
  className,
}: StampProps) {
  // `useState` y no la prop directa: así sólo cuenta el valor del montaje.
  const [slam] = useState(animate);

  return (
    <span
      data-stamp=""
      className={cn(
        "text-stamp inline-flex items-center gap-2 border-current font-extrabold whitespace-nowrap uppercase select-none",
        SIZE_CLASSES[size],
        double && "outline outline-1 outline-offset-2 outline-current",
        slam && "animate-stamp-slam motion-reduce:animate-none",
        className,
      )}
      style={slam && delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </span>
  );
}
