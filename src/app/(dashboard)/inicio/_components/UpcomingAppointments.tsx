"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { Tile } from "@/components/ui/Tile";
import { formatBusinessTime } from "@/lib/dates";
import { useTimerStore, useTimerStoreHydrated } from "@/store/timerStore";
import type { Appointment, Service } from "@/types";

interface UpcomingAppointmentsProps {
  appointments: Appointment[];
  services: Service[];
  /**
   * La consulta de la agenda falló. Se avisa en chico en vez de mostrar una
   * lista vacía, que se leería como "no tenés turnos" y es una mentira.
   */
  failed?: boolean;
}

/** Cuántos turnos entran en el cubo antes de mandar a la agenda completa. */
const MAX_VISIBLE = 4;

/**
 * Los turnos agendados de hoy, dentro de /inicio, con el botón para
 * empezarlos (2026-09-20). Es client component porque necesita el estado
 * del temporizador para dos cosas: pintar "Empezar" y **esconder** el turno
 * que ya está corriendo — el turno se muda de esta lista a la de
 * temporizadores, así que el cliente no aparece dos veces en la pantalla.
 *
 * Los datos siguen viniendo del servidor por props: acá no se decide nada,
 * sólo se dibuja y se arranca un contador local.
 *
 * Cobrar y cancelar siguen viviendo en `/agenda`, que es la pantalla con el
 * estado optimista por fila. Acá el cobro llega por otro lado: una vez
 * empezado, el turno se cierra desde su tarjeta de temporizador.
 */
export function UpcomingAppointments({
  appointments,
  services,
  failed = false,
}: UpcomingAppointmentsProps) {
  const hasHydrated = useTimerStoreHydrated();
  const timers = useTimerStore((state) => state.timers);
  const startTimer = useTimerStore((state) => state.startTimer);

  const serviceNames = new Map(
    services.map((service) => [service.id, service.name]),
  );

  const enCurso = new Set(
    timers
      .map((timer) => timer.appointmentId)
      .filter((id): id is string => Boolean(id)),
  );

  const agendados = appointments.filter(
    (appointment) => appointment.status === "scheduled",
  );

  // Antes de rehidratar se muestran todos, que es lo que renderizó el
  // servidor: filtrar con el store todavía vacío daría un HTML distinto al
  // del servidor y React tiraría un error de hidratación (la misma razón
  // por la que el store usa `skipHydration`).
  const pendientes = hasHydrated
    ? agendados.filter((appointment) => !enCurso.has(appointment.id))
    : agendados;

  const visibles = pendientes.slice(0, MAX_VISIBLE);
  const restantes = pendientes.length - visibles.length;
  const todosEnCurso = agendados.length > 0 && pendientes.length === 0;

  return (
    <Tile className="gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-muted text-[0.625rem] font-medium tracking-[0.14em] uppercase">
          Lo que viene
        </h2>
        <Link href="/agenda" className="text-accent-ink text-xs">
          Ver agenda
        </Link>
      </div>

      {failed ? (
        <p role="alert" className="text-danger text-sm">
          No pudimos cargar tus turnos de hoy.
        </p>
      ) : visibles.length === 0 ? (
        <p className="text-muted text-sm">
          {todosEnCurso
            ? "Todos los turnos de hoy están en curso."
            : "No tenés turnos agendados para hoy."}
        </p>
      ) : (
        <ul className="flex flex-col">
          {visibles.map((appointment) => (
            <li
              key={appointment.id}
              className="border-line flex items-center gap-3 border-b py-2.5 last:border-b-0 last:pb-0"
            >
              <span className="text-accent-ink w-12 flex-none font-mono text-[14px] font-medium tabular-nums">
                {formatBusinessTime(appointment.start_time)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px]">
                  {appointment.client_name ?? "Sin nombre"}
                </span>
                <span className="text-muted truncate text-[13px]">
                  {serviceNames.get(appointment.service_id) ??
                    "Servicio eliminado"}
                </span>
              </span>
              {/* No depende de que haya caja abierta: arrancar el contador es
                  estado local y tiene que funcionar con la red caída (regla
                  4 de CLAUDE.md). La caja se exige recién al cobrar. */}
              <button
                type="button"
                onClick={() =>
                  startTimer({
                    appointmentId: appointment.id,
                    serviceId: appointment.service_id,
                    label: appointment.client_name ?? undefined,
                  })
                }
                className="border-accent text-accent-ink ml-auto flex flex-none items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-transform duration-100 active:scale-95"
              >
                <Play size={12} strokeWidth={2} fill="currentColor" />
                Empezar
              </button>
            </li>
          ))}
        </ul>
      )}

      {restantes > 0 && (
        <Link href="/agenda" className="text-muted text-xs">
          +{restantes} {restantes === 1 ? "turno más" : "turnos más"}
        </Link>
      )}
    </Tile>
  );
}
