"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Play, Wallet } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { tileClasses } from "@/components/ui/Tile";
import { TimerCard } from "./TimerCard";
import { useTimerStore, useTimerStoreHydrated } from "@/store/timerStore";
import type { Service } from "@/types";

interface TimerListProps {
  cashSessionId: string | null;
  /**
   * Todos los servicios, activos o no. Los activos se filtran acá adentro
   * para el `select` del walk-in (mismo patrón que `AgendaView`); los
   * inactivos hacen falta porque un turno agendado que se está
   * cronometrando puede apuntar a un servicio que se desactivó después, y
   * su nombre igual tiene que poder mostrarse.
   */
  services: Service[];
}

/** Pantalla principal del barbero (spec 05): iniciar y ver temporizadores. */
export function TimerList({ cashSessionId, services }: TimerListProps) {
  const hasHydrated = useTimerStoreHydrated();
  const timers = useTimerStore((state) => state.timers);
  const startTimer = useTimerStore((state) => state.startTimer);
  const [label, setLabel] = useState("");

  function handleStart() {
    startTimer({ label: label.trim() || undefined });
    setLabel("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Un cubo que lleva a /caja y no un texto en rojo: la caja cerrada
          no es un error (empezar un corte no la necesita, regla 4) ni algo
          que ya pasó, así que tampoco va de sello (spec 10, regla 2). */}
      {!cashSessionId && (
        <Link
          href="/caja"
          className={tileClasses(
            "default",
            "flex-row items-center gap-3 px-3.5 py-3 transition-transform active:scale-[0.98]",
          )}
        >
          <span className="border-line bg-background text-muted grid h-9 w-9 flex-none place-items-center rounded-full border">
            <Wallet size={18} strokeWidth={1.5} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium">Tu caja está cerrada</span>
            <span className="text-muted text-xs">
              Abrila para poder cobrar los cortes.
            </span>
          </span>
          <span className="text-accent-ink flex flex-none items-center gap-0.5 text-sm font-medium">
            Abrir
            <ChevronRight size={16} strokeWidth={2} />
          </span>
        </Link>
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

      {/* El cubo relleno de la grilla: es el único elemento gritón de
          /inicio, y por eso el resto de los cubos van monocromos. */}
      <button
        type="button"
        onClick={handleStart}
        className="bg-accent text-accent-contrast rounded-tile flex w-full items-center justify-between gap-4 p-5 text-left transition-transform active:scale-[0.98]"
      >
        <span className="flex flex-col gap-1">
          <span className="text-[19px] font-semibold tracking-tight">
            Iniciar corte
          </span>
          <span className="text-[13px] opacity-80">
            Arranca el temporizador
          </span>
        </span>
        <span className="bg-accent-contrast text-accent grid h-13 w-13 flex-none place-items-center rounded-full">
          <Play size={22} strokeWidth={2} fill="currentColor" />
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
