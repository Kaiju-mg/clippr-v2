"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { scheduleAppointmentAction } from "@/actions/agenda.actions";
import { formatGuaranies } from "@/lib/utils";
import type { Service } from "@/types";

interface ScheduleInlineFormProps {
  services: Service[];
  dateISO: string;
  onCancel: () => void;
  onScheduled: () => void;
}

/**
 * Formulario in-line (sin modales, decisión del 2026-09-14) para agendar
 * un turno. Manda el día que se está mirando y la hora elegida por separado:
 * el servidor arma el instante con la zona horaria de la barbería, no con la
 * del celular.
 */
export function ScheduleInlineForm({
  services,
  dateISO,
  onCancel,
  onScheduled,
}: ScheduleInlineFormProps) {
  const [clientName, setClientName] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!serviceId) {
      setError("Elegí un servicio.");
      return;
    }
    if (!time) {
      setError("Elegí una hora de inicio.");
      return;
    }

    setIsLoading(true);

    const result = await scheduleAppointmentAction({
      clientName,
      serviceId,
      dateISO,
      time,
    });

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onScheduled();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3.5"
    >
      <Input
        id="schedule-client"
        label="Nombre del cliente"
        placeholder="Ej. Juan Pérez"
        value={clientName}
        onChange={(event) => setClientName(event.target.value)}
        required
      />

      <div className="flex flex-col gap-1">
        <label
          htmlFor="schedule-service"
          className="text-sm font-medium text-muted"
        >
          Servicio
        </label>
        <select
          id="schedule-service"
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
          className="rounded border border-line bg-background px-3 py-2 text-foreground"
          required
          disabled={services.length === 0}
        >
          {services.length === 0 ? (
            <option value="">No hay servicios activos</option>
          ) : (
            services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} — {formatGuaranies(service.price)}
              </option>
            ))
          )}
        </select>
      </div>

      <Input
        id="schedule-time"
        label="Hora de inicio"
        type="time"
        value={time}
        onChange={(event) => setTime(event.target.value)}
        required
      />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || services.length === 0}>
          {isLoading ? "Agendando..." : "Agendar"}
        </Button>
      </div>
    </form>
  );
}
