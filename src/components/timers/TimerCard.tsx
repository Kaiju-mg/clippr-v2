"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FinishWalkinForm } from "./FinishWalkinForm";
import { FinishAppointmentForm } from "./FinishAppointmentForm";
import { useTimerStore, type Timer } from "@/store/timerStore";
import { formatGuaranies } from "@/lib/utils";
import type { Service } from "@/types";

interface TimerCardProps {
  timer: Timer;
  cashSessionId: string | null;
  /** Todos los servicios, activos o no: un turno agendado puede apuntar a
   *  uno que se desactivó después y su nombre igual tiene que mostrarse. */
  services: Service[];
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * El tiempo transcurrido se calcula acá adentro, en un `useEffect` local
 * que compara contra `Date.now()` cada segundo — nunca en el store global
 * de Zustand (spec 05, sección 5): si `timers` cambiara cada segundo, toda
 * la app que lo lea (la lista completa) haría re-render en cascada.
 */
export function TimerCard({ timer, cashSessionId, services }: TimerCardProps) {
  const removeTimer = useTimerStore((state) => state.removeTimer);
  const [elapsedMs, setElapsedMs] = useState(
    () => Date.now() - timer.startTime,
  );
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - timer.startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer.startTime]);

  function handleDone() {
    removeTimer(timer.id);
    setIsFinishing(false);
  }

  // Un timer con `appointmentId` viene de un turno agendado (se arrancó
  // desde /inicio): ya sabe su servicio y su cliente, así que se cierra con
  // otro formulario y cobra por la acción de la agenda, no creando un
  // walk-in nuevo.
  const esTurnoAgendado = Boolean(timer.appointmentId);
  const service = timer.serviceId
    ? services.find((item) => item.id === timer.serviceId)
    : undefined;

  return (
    <div className="border-line bg-surface-2 rounded-tile border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          {timer.label && (
            <span className="truncate text-[15px] font-medium">
              {timer.label}
            </span>
          )}
          {esTurnoAgendado && service && (
            <span className="text-muted truncate text-[13px]">
              {service.name} · {formatGuaranies(service.price)}
            </span>
          )}
          <span className="font-display text-3xl font-semibold tabular-nums">
            {formatElapsed(elapsedMs)}
          </span>
        </div>
        {!isFinishing && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsFinishing(true)}
          >
            Finalizar
          </Button>
        )}
      </div>

      {isFinishing &&
        (esTurnoAgendado ? (
          <FinishAppointmentForm
            timer={timer}
            cashSessionId={cashSessionId}
            service={service}
            onCancel={() => setIsFinishing(false)}
            onDone={handleDone}
            onDiscard={handleDone}
          />
        ) : (
          <FinishWalkinForm
            timer={timer}
            cashSessionId={cashSessionId}
            services={services.filter((item) => item.is_active)}
            onCancel={() => setIsFinishing(false)}
            onDone={handleDone}
          />
        ))}
    </div>
  );
}
