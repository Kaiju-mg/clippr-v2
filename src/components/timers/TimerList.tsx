"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { TimerCard } from "./TimerCard";
import { useTimerStore, useTimerStoreHydrated } from "@/store/timerStore";
import type { Service } from "@/types";

interface TimerListProps {
  cashSessionId: string | null;
  services: Service[];
}

/** Pantalla principal del barbero (spec 05): iniciar y ver temporizadores. */
export function TimerList({ cashSessionId, services }: TimerListProps) {
  const hasHydrated = useTimerStoreHydrated();
  const timers = useTimerStore((state) => state.timers);
  const startTimer = useTimerStore((state) => state.startTimer);
  const [label, setLabel] = useState("");

  function handleStart() {
    startTimer(label.trim() || undefined);
    setLabel("");
  }

  return (
    <div className="flex flex-col gap-4">
      {!cashSessionId && (
        <p role="alert" className="text-danger text-sm">
          Debes abrir tu caja diaria antes de cobrar un corte.
        </p>
      )}

      {/* El input queda chico y secundario a propósito: sigue siendo la
          única forma de distinguir timers concurrentes (ej. un tinte
          esperando mientras se atiende a otro cliente, CLAUDE.md sección
          "Timers"), pero el botón gigante es la acción principal. */}
      <Input
        id="timer-label"
        label="Servicio (opcional)"
        placeholder="Ej. Tinte"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        className="py-1.5 text-sm"
      />

      <button
        type="button"
        onClick={handleStart}
        className="border-accent bg-background text-accent flex w-full items-center justify-center gap-2.5 rounded-2xl border-[1.5px] px-6 py-4 transition-transform active:scale-[0.98]"
      >
        <Play size={20} strokeWidth={2} fill="currentColor" />
        <span className="text-base font-semibold tracking-wide">
          Iniciar corte
        </span>
      </button>

      {!hasHydrated ? null : timers.length === 0 ? (
        <p className="text-muted text-sm">No hay temporizadores activos.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {timers.map((timer) => (
            <li key={timer.id}>
              <TimerCard
                timer={timer}
                cashSessionId={cashSessionId}
                services={services}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
