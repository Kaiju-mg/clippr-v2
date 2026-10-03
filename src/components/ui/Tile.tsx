import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TileVariant = "default" | "filled" | "plain";

/**
 * El "cubo" de la grilla bento. La jerarquía la da el tamaño del cubo y, en
 * uno solo por pantalla, el relleno — nunca el color del borde ni una
 * sombra (mismo criterio que `Button`: un solo elemento gritón por
 * pantalla, ver docs/decisiones.md).
 */
const VARIANT_CLASSES: Record<TileVariant, string> = {
  default: "bg-surface-2 border-line border",
  filled: "bg-accent text-accent-contrast",
  plain: "bg-background border-line border",
};

/**
 * Clases del cubo sin el elemento: para cuando el cubo tiene que ser un
 * `<a>` o un `<button>` de verdad y no un `div` con `onClick` (que el
 * teclado no alcanza).
 *
 * No fija la dirección del flex a propósito — quien la use elige `flex-col`
 * o `flex-row`. Si estuviera acá, un `flex-row` en `className` no la
 * pisaría: las dos clases pesan igual y gana la que Tailwind ponga después
 * en la hoja de estilos, no la última del atributo.
 */
export function tileClasses(
  variant: TileVariant = "default",
  className?: string,
) {
  return cn("rounded-tile flex p-4", VARIANT_CLASSES[variant], className);
}

interface TileProps {
  variant?: TileVariant;
  className?: string;
  children: ReactNode;
}

export function Tile({ variant = "default", className, children }: TileProps) {
  return (
    <div className={tileClasses(variant, cn("flex-col", className))}>
      {children}
    </div>
  );
}

interface StatTileProps {
  label: string;
  /** Sin valor el cubo se dibuja igual, sólo con la etiqueta: pasa cuando
   *  la consulta de estadísticas falla y no queremos inventar un número. */
  value?: string;
  hint?: string;
  icon?: ReactNode;
  /** Con `href` el cubo entero es un link. */
  href?: string;
  variant?: TileVariant;
  /** "lg" para un número corto (4, 17); "md" para un monto en guaraníes. */
  size?: "lg" | "md";
  /**
   * Cubo de media altura: menos aire y cifra más chica. Para cuando el cubo
   * acompaña y no es el dato principal de la pantalla — en `/inicio` la
   * acción es iniciar un corte, así que racha y cortes no pueden comerse
   * media pantalla (pedido del usuario, 2026-09-20).
   */
  compact?: boolean;
  className?: string;
}

/**
 * Cubo de un número: ícono arriba, cifra grande y etiqueta abajo. Reemplaza
 * al `StatCard` de la spec 08 y lo usan `/inicio` y `/estadisticas`, para
 * que los cubos midan y respiren igual en las dos pantallas.
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
  href,
  variant = "default",
  size = "lg",
  compact = false,
  className,
}: StatTileProps) {
  const mutedClass = variant === "filled" ? "opacity-80" : "text-muted";
  // `px-*`/`py-*` y no `p-*`: Tailwind ordena `p` antes que `px`/`py`, así
  // que estas ganan sobre el `p-4` de `tileClasses`. Al revés no funciona.
  const paddingClass = compact ? "px-3.5 py-3" : undefined;

  const content = (
    <>
      {icon && (
        <span className={cn(compact ? "mb-1.5" : "mb-3", mutedClass)}>
          {icon}
        </span>
      )}
      <div className="mt-auto flex flex-col gap-1">
        {value && (
          <span
            className={cn(
              "font-display tabular-nums",
              size === "lg"
                ? compact
                  ? "text-2xl leading-none font-normal tracking-tight"
                  : "text-[2rem] leading-none font-light tracking-tight"
                : "text-xl leading-tight font-medium tracking-tight",
            )}
          >
            {value}
          </span>
        )}
        <span
          className={cn(
            "text-[0.625rem] font-medium tracking-[0.14em] uppercase",
            mutedClass,
          )}
        >
          {label}
        </span>
        {hint && <span className={cn("text-xs", mutedClass)}>{hint}</span>}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={tileClasses(
          variant,
          cn(
            "flex-col transition-transform duration-100 active:scale-95",
            paddingClass,
            className,
          ),
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <Tile variant={variant} className={cn(paddingClass, className)}>
      {content}
    </Tile>
  );
}
