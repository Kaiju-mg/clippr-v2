"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { completeScheduledAppointmentAction } from "@/actions/agenda.actions";
import { formatGuaranies } from "@/lib/utils";
import { SinCajaAviso } from "./SinCajaAviso";
import type { Service } from "@/types";
import type { Timer } from "@/store/timerStore";

interface FinishAppointmentFormProps {
  /** Un timer con `appointmentId`: lo garantiza `TimerCard`. */
  timer: Timer;
  cashSessionId: string | null;
  /** Servicio del turno. Puede faltar si se desactivó del catálogo. */
  service?: Service;
  onCancel: () => void;
  onDone: () => void;
  /** Saca el temporizador de la lista sin cobrar nada. */
  onDiscard: () => void;
}

/**
 * Cierre de un turno agendado que se cronometró desde /inicio. A diferencia
 * del walk-in, acá no hay nada que preguntar: el servicio y el cliente ya
 * viven en el turno. El monto lo pone la base (el RPC
 * `complete_appointment_and_charge` lee el precio del servicio), así que el
 * precio de arriba es informativo.
 *
 * Ante cualquier error se ofrece **descartar el temporizador**, y no sólo
 * ante el turno ya actualizado: descartar nunca pierde plata, porque si el
 * turno sigue en `scheduled` se puede cobrar desde `/agenda`. La
 * alternativa era mirar el texto del mensaje de error para decidir, que se
 * rompe en silencio el día que alguien reescribe la copia.
 */
export function FinishAppointmentForm({
  timer,
  cashSessionId,
  service,
  onCancel,
  onDone,
  onDiscard,
}: FinishAppointmentFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!cashSessionId) {
    return <SinCajaAviso onCancel={onCancel} />;
  }

  // Capturado después del guard para que TypeScript lo vea como string
  // dentro del handler, sin un cast.
  const sessionId: string = cashSessionId;

  async function handleConfirm() {
    if (!timer.appointmentId) return;
    setError(null);
    setIsLoading(true);

    const result = await completeScheduledAppointmentAction(
      timer.appointmentId,
      sessionId,
    );

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onDone();
    router.refresh();
  }

  return (
    <div className="bg-background mt-3 flex flex-col gap-3 rounded-lg p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{service?.name ?? "Servicio del turno"}</span>
        {service && (
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatGuaranies(service.price)}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {error ? (
          <>
            <Button
              type="button"
              variant="danger"
              onClick={onDiscard}
              disabled={isLoading}
            >
              Descartar
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? "Cobrando..." : "Reintentar"}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? "Cobrando..." : "Cobrar"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
