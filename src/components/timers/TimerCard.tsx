"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FinishWalkinForm } from "./FinishWalkinForm";
import { useTimerStore, type Timer } from "@/store/timerStore";
import type { Service } from "@/types";

interface TimerCardProps {
  timer: Timer;
  cashSessionId: string | null;
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
  const [elapsedMs, setElapsedMs] = useState(() => Date.now() - timer.startTime);
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

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          {timer.label && (
            <span className="text-sm text-muted">{timer.label}</span>
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

      {isFinishing && (
        <FinishWalkinForm
          timer={timer}
          cashSessionId={cashSessionId}
          services={services}
          onCancel={() => setIsFinishing(false)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
