"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScheduleInlineForm } from "./ScheduleInlineForm";
import { AppointmentRow } from "./AppointmentRow";
import { formatBusinessDateLabel, shiftDateISO } from "@/lib/dates";
import type { Appointment, Service } from "@/types";
import { BlankTicket } from "@/components/ticket/BlankTicket";

interface AgendaViewProps {
  dateISO: string;
  /** El día que se está mirando es posterior a hoy (lo decide el servidor). */
  esDiaFuturo: boolean;
  appointments: Appointment[];
  cashSessionId: string | null;
  services: Service[];
}

/**
 * Pantalla de agenda (spec 06): navegación día a día vía query param
 * (`?date=`, no estado de URL propio) para que cada cambio de día sea un
 * fetch real al servidor, igual que cualquier otra pantalla de la app.
 */
export function AgendaView({
  dateISO,
  esDiaFuturo,
  appointments,
  cashSessionId,
  services,
}: AgendaViewProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeServices = services.filter((service) => service.is_active);
  const servicesById = new Map(
    services.map((service) => [service.id, service]),
  );

  function goToDate(nextDateISO: string) {
    startTransition(() => {
      router.push(`/agenda?date=${nextDateISO}`);
    });
  }

  function handleScheduled() {
    setIsCreating(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Agenda</h1>
        <Button
          onClick={() => setIsCreating((current) => !current)}
          variant={isCreating ? "secondary" : "primary"}
        >
          {isCreating ? "Cancelar" : "Nuevo turno"}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goToDate(shiftDateISO(dateISO, -1))}
          disabled={isPending}
          aria-label="Día anterior"
          className="border-line text-muted grid h-8 w-8 place-items-center rounded-md border disabled:opacity-50"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <span className="text-sm font-medium">
          {formatBusinessDateLabel(dateISO)}
        </span>
        <button
          type="button"
          onClick={() => goToDate(shiftDateISO(dateISO, 1))}
          disabled={isPending}
          aria-label="Día siguiente"
          className="border-line text-muted grid h-8 w-8 place-items-center rounded-md border disabled:opacity-50"
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>

      {isCreating && (
        <ScheduleInlineForm
          services={activeServices}
          dateISO={dateISO}
          onCancel={() => setIsCreating(false)}
          onScheduled={handleScheduled}
        />
      )}

      {appointments.length === 0 && !isCreating ? (
        <BlankTicket
          text="Todavía no hay turnos para este día."
          className="py-4"
        >
          <Button onClick={() => setIsCreating(true)}>
            Agendar el primer turno
          </Button>
        </BlankTicket>
      ) : (
        <ul className="flex flex-col">
          {appointments.map((appointment) => {
            const service = servicesById.get(appointment.service_id);
            return (
              // Punteado: cada turno es plata (spec 10, regla 3).
              <li
                key={appointment.id}
                className="border-muted/55 border-b border-dashed last:border-b-0"
              >
                <AppointmentRow
                  appointment={appointment}
                  serviceName={service?.name ?? "Servicio eliminado"}
                  servicePrice={service?.price ?? 0}
                  cashSessionId={cashSessionId}
                  esDiaFuturo={esDiaFuturo}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
