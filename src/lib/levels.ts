/**
 * Niveles del barbero como "ligas": el nivel refleja el rendimiento de los
 * últimos 30 días móviles, no un acumulado histórico irreversible. Si el
 * barbero baja el ritmo, baja de liga y tiene un motivo para volver a
 * subir — decisión del usuario (2026-09-17), ver docs/decisiones.md.
 *
 * Los umbrales viven acá y no dentro del Server Action para poder ajustarlos
 * sin tocar la lógica de cierre de caja, y para que la UI muestre la misma
 * escala que la que se evalúa en el servidor.
 */
import type { UserLevel } from "@/types";

/** Ventana móvil (en días, incluyendo hoy) sobre la que se cuenta. */
export const LEVEL_WINDOW_DAYS = 30;

/**
 * Cortes mínimos en la ventana para alcanzar cada nivel, de mayor a menor.
 * Junior es el piso: siempre se cumple.
 */
export const LEVEL_THRESHOLDS: ReadonlyArray<{
  level: UserLevel;
  minCuts: number;
}> = [
  { level: "elite", minCuts: 151 },
  { level: "senior", minCuts: 91 },
  { level: "pro", minCuts: 40 },
  { level: "junior", minCuts: 0 },
];

export const LEVEL_LABELS: Record<UserLevel, string> = {
  junior: "Junior",
  pro: "Pro",
  senior: "Senior",
  elite: "Élite",
};

/** Nivel que corresponde a una cantidad de cortes en la ventana. */
export function levelForCuts(cuts: number): UserLevel {
  const match = LEVEL_THRESHOLDS.find(
    (threshold) => cuts >= threshold.minCuts,
  );
  return match?.level ?? "junior";
}

export interface LevelProgress {
  level: UserLevel;
  cuts: number;
  /** Siguiente nivel, o null si ya está en el más alto. */
  nextLevel: UserLevel | null;
  /** Cortes que faltan para el siguiente nivel (0 si ya está en el tope). */
  cutsToNext: number;
  /** Avance dentro del tramo actual, 0..1. En el tope siempre es 1. */
  ratio: number;
}

/**
 * Progreso hacia el siguiente nivel, para la barra de la pantalla de
 * estadísticas. El avance se mide dentro del tramo actual (del umbral del
 * nivel que tiene al del siguiente), no sobre el total: si no, alguien
 * recién ascendido a Pro vería la barra casi vacía.
 */
export function levelProgress(cuts: number): LevelProgress {
  const safeCuts = Number.isFinite(cuts) && cuts > 0 ? Math.floor(cuts) : 0;
  const level = levelForCuts(safeCuts);
  const index = LEVEL_THRESHOLDS.findIndex(
    (threshold) => threshold.level === level,
  );
  // LEVEL_THRESHOLDS va de mayor a menor: el siguiente nivel es el anterior
  // del arreglo.
  const next = index > 0 ? LEVEL_THRESHOLDS[index - 1] : null;
  const currentMin = LEVEL_THRESHOLDS[index]?.minCuts ?? 0;

  if (!next) {
    return {
      level,
      cuts: safeCuts,
      nextLevel: null,
      cutsToNext: 0,
      ratio: 1,
    };
  }

  const span = next.minCuts - currentMin;
  return {
    level,
    cuts: safeCuts,
    nextLevel: next.level,
    cutsToNext: Math.max(0, next.minCuts - safeCuts),
    // span nunca es 0 con los umbrales de arriba, pero la división queda
    // protegida igual (caso borde 2 de la spec: nada de dividir por cero).
    ratio: span > 0 ? Math.min(1, (safeCuts - currentMin) / span) : 1,
  };
}
