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
import { randomId } from "@/lib/ids";

export interface Timer {
  id: string;
  startTime: number;
  label?: string;
  /**
   * Turno agendado que este temporizador está cronometrando. **Sin esto es
   * un walk-in**, que es cómo funcionaba el store entero hasta el
   * 2026-09-20 — por eso es opcional y no hay que migrar lo que ya esté
   * guardado en `localStorage`. Con `appointmentId`, el cobro va por
   * `completeScheduledAppointmentAction` en vez de crear un turno nuevo.
   */
  appointmentId?: string;
  /** Servicio del turno, para mostrar nombre y precio en la tarjeta. */
  serviceId?: string;
}

export interface StartTimerInput {
  label?: string;
  appointmentId?: string;
  serviceId?: string;
}

interface TimerState {
  timers: Timer[];
  startTimer: (input?: StartTimerInput) => string;
  removeTimer: (id: string) => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: [],
      startTimer: (input = {}) => {
        const { label, appointmentId, serviceId } = input;

        // Un turno agendado no puede tener dos temporizadores: el doble tap
        // pasa, y más en un celular. Se devuelve el que ya estaba corriendo.
        if (appointmentId) {
          const existente = get().timers.find(
            (timer) => timer.appointmentId === appointmentId,
          );
          if (existente) return existente.id;
        }

        // randomId y no crypto.randomUUID: esta última no existe fuera de un
        // contexto seguro, y la app se prueba por IP con HTTP plano desde el
        // celular. Ver src/lib/ids.ts.
        const id = randomId();
        set((state) => ({
          timers: [
            ...state.timers,
            { id, startTime: Date.now(), label, appointmentId, serviceId },
          ],
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
 * Una sola rehidratación por carga de página, aunque el hook se use en
 * varios componentes: desde el 2026-09-20 lo llaman `TimerList` y
 * `UpcomingAppointments`, y sin este flag cada uno leería `localStorage`
 * por su cuenta.
 */
let rehidratacionPedida = false;

/**
 * **`useTimerStore.persist` no existe en el servidor.** Cuando no hay
 * `localStorage`, el middleware `persist` de Zustand avisa por consola y
 * devuelve el store pelado, sin colgarle la API de persistencia. Así que
 * cualquier lectura de `.persist` que corra **durante el render** —y el
 * render de un client component también pasa por el servidor— revienta con
 * "Cannot read properties of undefined". Pasó: tumbó `/inicio` con un 500
 * el 2026-09-20. Por eso el `?.` en los tres accesos.
 */
function persistApi() {
  return useTimerStore.persist as typeof useTimerStore.persist | undefined;
}

/**
 * Dispara la rehidratación desde localStorage después del mount (nunca en
 * SSR) y devuelve si ya terminó. Usarlo en cualquier componente que lea el
 * store, para evitar el parpadeo de "sin temporizadores" antes de que se
 * restaure el estado guardado.
 *
 * Arranca en `false` en el servidor y en el primer render del cliente, que
 * es lo que evita el error de hidratación; en un mount posterior (navegar
 * de /caja a /inicio sin recargar) el store ya está hidratado y arranca en
 * `true`, para no mostrar un parpadeo de la lista sin filtrar.
 */
export function useTimerStoreHydrated(): boolean {
  const [hasHydrated, setHasHydrated] = useState(
    () => persistApi()?.hasHydrated() ?? false,
  );

  useEffect(() => {
    const persist = persistApi();
    if (!persist) return;

    if (persist.hasHydrated()) {
      setHasHydrated(true);
      return;
    }

    const unsubscribe = persist.onFinishHydration(() => setHasHydrated(true));

    if (!rehidratacionPedida) {
      rehidratacionPedida = true;
      void persist.rehydrate();
    }

    return unsubscribe;
  }, []);

  return hasHydrated;
}
