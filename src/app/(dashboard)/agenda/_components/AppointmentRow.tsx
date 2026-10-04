"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  completeScheduledAppointmentAction,
  cancelAppointmentAction,
} from "@/actions/agenda.actions";
import { formatBusinessTime } from "@/lib/dates";
import { formatGuaranies } from "@/lib/utils";
import type { Appointment, AppointmentStatus } from "@/types";

interface AppointmentRowProps {
  appointment: Appointment;
  serviceName: string;
  servicePrice: number;
  cashSessionId: string | null;
  /**
   * El día que se está mirando es posterior a hoy. Lo resuelve el servidor
   * (`agenda/page.tsx`) con la zona del negocio, no el reloj del celular.
   */
  esDiaFuturo: boolean;
}

const STATUS_LABELS: Partial<Record<AppointmentStatus, string>> = {
  completed: "Cobrado",
  cancelled: "Cancelado",
  walkin: "Cobrado",
};

/**
 * Fila de un turno en la agenda (spec 06). `useOptimistic` marca el
 * cambio de estado al toque, sin esperar la resolución del servidor
 * (tolerancia a internet inestable, CLAUDE.md regla 4); `router.refresh()`
 * al final reconcilia con el estado real (por ejemplo, si la caja se
 * cerró justo antes de cobrar).
 *
 * En un día futuro no se muestra "Cobrar": el servidor ya rechazaba esos
 * cobros, pero el estado optimista alcanzaba a pintar "Cobrado" un par de
 * segundos antes de que la fila volviera atrás sola (visto en el navegador
 * el 2026-09-16). Se saca el botón en vez de sólo deshabilitarlo — un botón
 * gris sin explicación es peor que ninguno; la leyenda dice por qué.
 */
export function AppointmentRow({
  appointment,
  serviceName,
  servicePrice,
  cashSessionId,
  esDiaFuturo,
}: AppointmentRowProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    appointment.status,
    (_current: AppointmentStatus, next: AppointmentStatus) => next,
  );

  function handleComplete() {
    if (!cashSessionId) return;
    setError(null);

    startTransition(async () => {
      setOptimisticStatus("completed");
      const result = await completeScheduledAppointmentAction(
        appointment.id,
        cashSessionId,
      );
      if (!result.success) {
        setError(result.error);
      }
      router.refresh();
    });
  }

  function handleCancel() {
    setError(null);

    startTransition(async () => {
      setOptimisticStatus("cancelled");
      const result = await cancelAppointmentAction(appointment.id);
      if (!result.success) {
        setError(result.error);
      }
      router.refresh();
    });
  }

  const isScheduled = optimisticStatus === "scheduled";

  return (
    <div className="flex flex-col gap-2 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div
          className={`flex min-w-0 flex-col gap-1 ${isScheduled ? "" : "opacity-40"}`}
        >
          <span className="font-display truncate text-[17px] font-semibold">
            {appointment.client_name ?? "Sin nombre"}
          </span>
          <span className="text-muted text-[13px]">
            <span className="font-mono tabular-nums">
              {formatBusinessTime(appointment.start_time)}
            </span>{" "}
            · {serviceName}
          </span>
        </div>
        <span
          className={`text-accent-ink font-mono text-[15px] font-semibold whitespace-nowrap tabular-nums ${
            isScheduled ? "" : "opacity-40"
          }`}
        >
          {formatGuaranies(servicePrice)}
        </span>
      </div>

      {isScheduled ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-danger"
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancelar
          </Button>
          {esDiaFuturo ? (
            <span className="text-muted text-[13px]">
              Se cobra el día del turno
            </span>
          ) : (
            <Button
              type="button"
              onClick={handleComplete}
              disabled={isPending || !cashSessionId}
            >
              Cobrar
            </Button>
          )}
        </div>
      ) : (
        <span className="text-muted text-right text-[13px]">
          {STATUS_LABELS[optimisticStatus] ?? optimisticStatus}
        </span>
      )}

      {isScheduled && !esDiaFuturo && !cashSessionId && (
        <p
          role="alert"
          className="text-danger flex items-center justify-end gap-2 text-sm"
        >
          Debes abrir tu caja diaria antes de cobrar un corte.
          <Link href="/caja" className="underline">
            Ir a caja
          </Link>
        </p>
      )}

      {error && (
        <p role="alert" className="text-danger text-right text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
