"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScheduleInlineForm } from "./ScheduleInlineForm";
import { AppointmentRow } from "./AppointmentRow";
import type { Appointment, Service } from "@/types";

interface AgendaViewProps {
  dateISO: string;
  appointments: Appointment[];
  cashSessionId: string | null;
  services: Service[];
}

function shiftDate(dateISO: string, deltaDays: number): string {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(dateISO: string): string {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  const label = new Intl.DateTimeFormat("es-PY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Pantalla de agenda (spec 06): navegación día a día vía query param
 * (`?date=`, no estado de URL propio) para que cada cambio de día sea un
 * fetch real al servidor, igual que cualquier otra pantalla de la app.
 */
export function AgendaView({
  dateISO,
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
          onClick={() => goToDate(shiftDate(dateISO, -1))}
          disabled={isPending}
          aria-label="Día anterior"
          className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted disabled:opacity-50"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <span className="text-sm font-medium">{formatDateLabel(dateISO)}</span>
        <button
          type="button"
          onClick={() => goToDate(shiftDate(dateISO, 1))}
          disabled={isPending}
          aria-label="Día siguiente"
          className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted disabled:opacity-50"
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
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted">
            Todavía no hay turnos para este día.
          </p>
          <Button onClick={() => setIsCreating(true)}>
            Agendar el primer turno
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col">
          {appointments.map((appointment) => {
            const service = servicesById.get(appointment.service_id);
            return (
              <li
                key={appointment.id}
                className="border-b border-line last:border-b-0"
              >
                <AppointmentRow
                  appointment={appointment}
                  serviceName={service?.name ?? "Servicio eliminado"}
                  servicePrice={service?.price ?? 0}
                  cashSessionId={cashSessionId}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
