"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  completeScheduledAppointmentAction,
  cancelAppointmentAction,
} from "@/actions/agenda.actions";
import { formatGuaranies } from "@/lib/utils";
import type { Appointment, AppointmentStatus } from "@/types";

interface AppointmentRowProps {
  appointment: Appointment;
  serviceName: string;
  servicePrice: number;
  cashSessionId: string | null;
}

const STATUS_LABELS: Partial<Record<AppointmentStatus, string>> = {
  completed: "Cobrado",
  cancelled: "Cancelado",
  walkin: "Cobrado",
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-PY", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Fila de un turno en la agenda (spec 06). `useOptimistic` marca el
 * cambio de estado al toque, sin esperar la resolución del servidor
 * (tolerancia a internet inestable, CLAUDE.md regla 4); `router.refresh()`
 * al final reconcilia con el estado real (por ejemplo, si la caja se
 * cerró justo antes de cobrar).
 */
export function AppointmentRow({
  appointment,
  serviceName,
  servicePrice,
  cashSessionId,
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
          <span className="text-[13px] text-muted">
            {formatTime(appointment.start_time)} · {serviceName}
          </span>
        </div>
        <span
          className={`whitespace-nowrap text-[17px] font-bold tabular-nums text-accent ${
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
          <Button
            type="button"
            onClick={handleComplete}
            disabled={isPending || !cashSessionId}
          >
            Cobrar
          </Button>
        </div>
      ) : (
        <span className="text-right text-[13px] text-muted">
          {STATUS_LABELS[optimisticStatus] ?? optimisticStatus}
        </span>
      )}

      {isScheduled && !cashSessionId && (
        <p
          role="alert"
          className="flex items-center justify-end gap-2 text-sm text-danger"
        >
          Debes abrir tu caja diaria antes de cobrar un corte.
          <Link href="/caja" className="underline">
            Ir a caja
          </Link>
        </p>
      )}

      {error && (
        <p role="alert" className="text-right text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
