import type { ReactNode } from "react";
import { Courier_Prime } from "next/font/google";
import { cn } from "@/lib/utils";

/**
 * Courier Prime sólo para el ticket (spec 10): `preload: false` para que el
 * archivo no se baje en todas las pantallas del dashboard, sino recién cuando
 * aparece un ticket en pantalla.
 */
const courier = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

export type TicketLine =
  | { kind: "center"; text: string; strong?: boolean }
  | { kind: "row"; label: string; value: string; strong?: boolean }
  | { kind: "rule" };

interface TicketReceiptProps {
  /** Renglones ya calculados: el ticket no suma ni decide nada. */
  lines: readonly TicketLine[];
  /** Lo que va abajo de los renglones (el sello de la racha, un saludo). */
  footer?: ReactNode;
  /** Nombre accesible del ticket. */
  label?: string;
  className?: string;
}

/**
 * El papel del recibo (spec 10): `--paper` y `--paper-ink`, Courier Prime a
 * 11,5px, separadores punteados en `--paper-rule` y el borde de abajo en
 * zigzag. Es un objeto y no una superficie (regla 4): no cambia con el tema,
 * y por eso adentro el sello usa el rojo claro (`--paper-stamp`).
 *
 * Sólo de presentación: lo reusan el cierre de caja, la imagen para
 * compartir (fase 3) y los cierres del equipo (fase 4).
 */
export function TicketReceipt({
  lines,
  footer,
  label = "Ticket",
  className,
}: TicketReceiptProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        courier.className,
        "ticket-edge bg-paper text-paper-ink w-full max-w-[250px] px-3 pt-3.5 pb-2 text-[11.5px] leading-normal",
        "[--edge-color:var(--paper)] [--edge-size:9px] [--stamp:var(--paper-stamp)]",
        className,
      )}
    >
      {lines.map((line, index) => {
        if (line.kind === "rule") {
          return (
            <hr
              key={index}
              className="border-paper-rule my-[5px] border-0 border-t border-dashed"
            />
          );
        }
        if (line.kind === "center") {
          return (
            <p
              key={index}
              className={cn(
                "m-0 text-center",
                line.strong && "text-[13px] font-bold tracking-[0.08em]",
              )}
            >
              {line.text}
            </p>
          );
        }
        return (
          <p
            key={index}
            className={cn(
              "m-0 flex justify-between gap-1.5",
              line.strong && "text-[13.5px] font-bold",
            )}
          >
            <span>{line.label}</span>
            <span className="text-right whitespace-nowrap">{line.value}</span>
          </p>
        );
      })}
      {footer}
    </section>
  );
}
