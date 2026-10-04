import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { courier } from "./fonts";

interface BlankTicketProps {
  /** La única línea escrita a máquina: "Todavía no hay turnos…". */
  text: string;
  /**
   * `inset` cuando el ticket va adentro de un cubo (que ya es
   * `--surface-2`): con el fondo de la pantalla, para que se vea la forma
   * del ticket y el zigzag.
   */
  tone?: "default" | "inset";
  /** Lo que va debajo del ticket (el botón para cargar el primero). */
  children?: ReactNode;
  className?: string;
}

/** Un renglón vacío del ticket: sólo el punteado. */
function EmptyLine() {
  return <span className="border-muted/40 block h-0 border-t border-dashed" />;
}

/**
 * Pantalla vacía como un ticket en blanco (spec 10, fase 4): el mismo papel
 * que los movimientos de `/caja` (`--surface-2` con borde en zigzag), con
 * renglones punteados sin nada y una sola línea escrita a máquina. Reemplaza
 * los "Todavía no hay…" sueltos.
 *
 * Es una superficie de la app y no el papel del recibo (`--paper`): una
 * lista vacía no es un objeto que se imprime, así que sigue al tema.
 */
export function BlankTicket({
  text,
  tone = "default",
  children,
  className,
}: BlankTicketProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div
        data-blank-ticket=""
        className={cn(
          "ticket-edge mb-2 flex w-full flex-col gap-3.5 rounded-t-[14px] px-5 pt-5 pb-4",
          tone === "inset"
            ? "bg-background [--edge-color:var(--background)]"
            : "bg-surface-2 [--edge-color:var(--surface-2)]",
        )}
      >
        <EmptyLine />
        <p
          className={cn(
            courier.className,
            "text-muted m-0 text-center text-[13px] leading-snug",
          )}
        >
          {text}
        </p>
        <EmptyLine />
        <EmptyLine />
      </div>
      {children}
    </div>
  );
}
