import { BlankTicket } from "@/components/ticket/BlankTicket";
import { closeTicketLines } from "@/components/ticket/closeTicketLines";
import { TicketReceipt } from "@/components/ticket/TicketReceipt";
import type { TeamClosure } from "@/actions/stats.actions";

interface TeamClosuresProps {
  /** null: la consulta falló (se avisa en vez de mostrar "nadie cerró"). */
  closures: TeamClosure[] | null;
}

/**
 * "Cierres de hoy" en `/estadisticas` del dueño (spec 10, fase 4): el ticket
 * de cada caja que se cerró hoy, en fila con scroll horizontal en el
 * celular. Son los mismos renglones que imprimió el cierre
 * (`closeTicketLines`), con el resumen que armó el servidor.
 *
 * Va siempre con los de hoy, sea cual sea el rango elegido arriba: es "cómo
 * cerró el día", no una métrica del periodo.
 */
export function TeamClosures({ closures }: TeamClosuresProps) {
  return (
    <section aria-labelledby="cierres-de-hoy" className="flex flex-col gap-3">
      <h2
        id="cierres-de-hoy"
        className="text-muted text-[0.625rem] font-medium tracking-[0.14em] uppercase"
      >
        Cierres de hoy
      </h2>

      {closures === null ? (
        <p role="alert" className="text-danger text-sm">
          No pudimos cargar los cierres de hoy.
        </p>
      ) : closures.length === 0 ? (
        <BlankTicket text="Nadie cerró la caja hoy todavía." />
      ) : (
        // `-mx-4 px-4`: el scroll llega al borde de la pantalla, pero el
        // primer ticket arranca alineado con el resto del contenido.
        // `scroll-px-4`: sin eso el `snap-start` alinea el ticket al borde
        // del contenedor y se come el padding (visto a 360 px).
        <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3">
          {closures.map((closure) => (
            <li
              key={closure.sessionId}
              // En claro el papel y el fondo son del mismo color: la sombra
              // (con `drop-shadow`, que sigue también el zigzag) separa el
              // ticket de la página.
              className="flex-none snap-start drop-shadow-[0_2px_6px_rgba(38,35,29,0.18)]"
            >
              <TicketReceipt
                label={`Cierre de ${closure.barberName ?? "un barbero"}`}
                lines={closeTicketLines(closure.summary, {
                  closedAt: closure.closedAt,
                  barberName: closure.barberName,
                })}
                className="w-[230px]"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
