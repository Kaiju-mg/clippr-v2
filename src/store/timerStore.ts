"use client";

/**
 * Store global de temporizadores (spec 05). Arreglo, no uno solo: un
 * barbero puede tener varios corriendo a la vez (ej. esperar un tinte
 * mientras atiende a otro cliente) — ver la regla no negociable #3 de
 * CLAUDE.md y docs/aprendizajes-v1.md.
 *
 * Zustand solo guarda `startTime` (una marca de tiempo estática), nunca
 * los segundos transcurridos: si el estado global cambiara cada segundo,
 * toda la app que lea el store haría re-render. El conteo visible se
 * calcula localmente en cada `TimerCard` con `Date.now() - startTime`.
 *
 * Persistencia en localStorage vía `persist`: un timer sobrevive a un F5,
 * a cerrar la pestaña o a que se caiga la conexión, porque se reconstruye
 * comparando contra la hora actual del sistema, no contra un intervalo que
 * corría en memoria.
 */
import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Timer {
  id: string;
  startTime: number;
  label?: string;
}

interface TimerState {
  timers: Timer[];
  startTimer: (label?: string) => string;
  removeTimer: (id: string) => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      timers: [],
      startTimer: (label) => {
        const id = crypto.randomUUID();
        set((state) => ({
          timers: [...state.timers, { id, startTime: Date.now(), label }],
        }));
        return id;
      },
      removeTimer: (id) =>
        set((state) => ({
          timers: state.timers.filter((timer) => timer.id !== id),
        })),
    }),
    {
      name: "clippr-timers",
      // No rehidratar automáticamente al crear el store: en Next.js el
      // primer render del cliente también corre en el servidor (SSR), que
      // no tiene localStorage. Si `persist` leyera el storage de forma
      // síncrona ahí, el HTML del servidor (siempre timers: []) no
      // coincidiría con el primer render del cliente (ya con los timers
      // guardados), y React tira un error de hydration mismatch.
      // `useTimerStoreHydrated` dispara la rehidratación real recién
      // después del mount, cuando ya no hay SSR de por medio.
      skipHydration: true,
    },
  ),
);

/**
 * Dispara la rehidratación desde localStorage después del mount (nunca en
 * SSR) y devuelve si ya terminó. Usarlo en el componente raíz de la
 * pantalla de temporizadores para evitar el parpadeo de "sin
 * temporizadores" antes de que se restaure el estado guardado.
 */
export function useTimerStoreHydrated(): boolean {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useTimerStore.persist.onFinishHydration(() =>
      setHasHydrated(true),
    );
    void useTimerStore.persist.rehydrate();

    return unsubscribe;
  }, []);

  return hasHydrated;
}
