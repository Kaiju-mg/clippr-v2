"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OfflineNotice } from "@/components/ui/OfflineNotice";
import { Stamp } from "@/components/ui/Stamp";
import { useOnline } from "@/lib/useOnline";
import { PULSO_SELLO } from "@/lib/haptics";
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

/** Un walk-in ya entra cobrado, igual que un turno completado. */
function estaCobrado(status: AppointmentStatus): boolean {
  return status === "completed" || status === "walkin";
}

/** Píldora chica del segundo renglón (muestrario "Clippr en papel"). */
const PILL =
  "rounded-full px-3 py-1.5 text-xs font-semibold transition-transform duration-100 active:scale-95 disabled:opacity-50 disabled:active:scale-100";

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
 *
 * Tema Recibo (spec 10): lo cobrado lleva el sello COBRADO y la fila se
 * atenúa (el sello no); lo cancelado va tachado y atenuado, sin sello. El
 * sello cae sólo si el turno se cobra mientras se mira la pantalla: los que
 * ya venían cobrados al cargar aparecen sellados, quietos.
 *
 * Sin señal (spec 10, fase 3), "Cobrar" se deshabilita con "Sin señal ·
 * todavía no se cobró": sin eso, el sello optimista caía y la fila volvía
 * atrás sola al fallar el Server Action.
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
  // El estado con el que se montó la fila: decide si el sello cae o no.
  const [statusAlCargar] = useState(appointment.status);
  const online = useOnline();

  function handleComplete() {
    if (!cashSessionId || !online) return;
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
  const cobrado = estaCobrado(optimisticStatus);
  const cancelado = optimisticStatus === "cancelled";
  const atenuado = cobrado || cancelado ? "opacity-45" : "";

  return (
    <div className="flex flex-col gap-1.5 py-3">
      <div className="flex items-center gap-3">
        <span
          className={`w-11 flex-none font-mono text-[13.5px] font-medium tabular-nums ${atenuado}`}
        >
          {formatBusinessTime(appointment.start_time)}
        </span>
        <div className={`flex min-w-0 flex-1 flex-col ${atenuado}`}>
          <span
            className={`truncate text-[15px] font-semibold ${
              cancelado ? "decoration-muted line-through" : ""
            }`}
          >
            {appointment.client_name ?? "Sin nombre"}
          </span>
          <span className="text-muted truncate text-xs">{serviceName}</span>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <span
            className={`font-mono text-[13.5px] font-semibold whitespace-nowrap tabular-nums ${
              cancelado ? "" : "text-accent-ink"
            } ${atenuado}`}
          >
            {formatGuaranies(servicePrice)}
          </span>
          {cobrado && (
            <Stamp
              animate={statusAlCargar === "scheduled"}
              haptic={PULSO_SELLO}
            >
              Cobrado
            </Stamp>
          )}
          {cancelado && <span className="text-muted text-xs">Cancelado</span>}
        </div>
      </div>

      {isScheduled && (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className={`${PILL} text-muted`}
          >
            Cancelar
          </button>
          {esDiaFuturo ? (
            <span className="text-muted text-xs">
              Se cobra el día del turno
            </span>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={isPending || !cashSessionId || !online}
              className={`${PILL} border-line bg-background text-foreground border`}
            >
              Cobrar
            </button>
          )}
        </div>
      )}

      {isScheduled && !esDiaFuturo && cashSessionId && !online && (
        <div className="flex justify-end">
          <OfflineNotice pending="se cobró" />
        </div>
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
