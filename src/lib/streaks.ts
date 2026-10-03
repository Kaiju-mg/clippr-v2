/**
 * Racha de días trabajados, con un día de gracia. Decisión del usuario
 * (2026-09-17, ver docs/decisiones.md): la app no sabe qué días cierra cada
 * barbería, así que en vez de modelar "días hábiles" se tolera un hueco de
 * un día. Eso cubre el domingo de una barbería, el lunes de otra, o el
 * martes que el barbero faltó por un trámite, sin ninguna configuración.
 *
 * Lógica pura y separada del Server Action para poder testear los casos
 * borde sin mockear Supabase.
 */
import { daysBetweenDateISO } from "@/lib/dates";

/**
 * Diferencia máxima (en días calendario) contra la última jornada válida
 * para que la racha siga viva. 2 = ayer o anteayer.
 */
export const STREAK_GRACE_DAYS = 2;

/**
 * Nueva racha al cerrar una caja con actividad.
 *
 * @param currentStreak racha guardada hoy en `users.streak_count`.
 * @param lastWorkedDate día del negocio de la última jornada válida
 *   *anterior a `todayDate`*, o null si no hay ninguna.
 * @param sameDayAlreadyCounted true si el barbero ya cerró hoy otra caja con
 *   actividad: la jornada ya sumó, no se cuenta dos veces.
 */
export function nextStreakCount(
  currentStreak: number,
  lastWorkedDate: string | null,
  todayDate: string,
  sameDayAlreadyCounted: boolean,
): number {
  const safeCurrent =
    Number.isFinite(currentStreak) && currentStreak > 0
      ? Math.floor(currentStreak)
      : 0;

  // Segunda caja del mismo día (cerró a la tarde y abrió otra a la noche):
  // la racha ya se evaluó en el primer cierre.
  if (sameDayAlreadyCounted) {
    return Math.max(safeCurrent, 1);
  }

  if (!lastWorkedDate) {
    return 1;
  }

  const gap = daysBetweenDateISO(lastWorkedDate, todayDate);

  // gap <= 0 no debería pasar (lastWorkedDate es estrictamente anterior),
  // pero si el reloj o los datos vinieran raros, no rompemos la racha.
  if (gap <= 0) {
    return Math.max(safeCurrent, 1);
  }

  return gap <= STREAK_GRACE_DAYS ? safeCurrent + 1 : 1;
}

export type StreakStatus = "activa" | "en_peligro" | "apagada";

/**
 * Cómo está la racha *hoy*, para mostrarla (el poste de barbería, decisión
 * del 2026-10-03). Se deriva de la última jornada válida y no se guarda en
 * ningún lado: `users.streak_count` sólo se recalcula al cerrar una caja, así
 * que un barbero que no cierra hace una semana sigue teniendo su número
 * viejo guardado aunque la racha ya esté perdida.
 *
 * - `activa`: la última jornada fue hoy o ayer. El poste gira.
 * - `en_peligro`: fue anteayer — hoy es el día de gracia y cerrar una caja
 *   con un cobro todavía la salva. El poste se frena.
 * - `apagada`: más de un día salteado, o nunca hubo racha. Cerrar hoy la
 *   arranca de nuevo en 1. El poste queda gris.
 *
 * @param lastWorkedDate día del negocio de la última caja *cerrada* con al
 *   menos un ingreso (puede ser hoy), o null si no hay ninguna.
 */
export function streakStatus(
  streakCount: number,
  lastWorkedDate: string | null,
  todayDate: string,
): StreakStatus {
  if (!(streakCount > 0) || !lastWorkedDate) return "apagada";

  const gap = daysBetweenDateISO(lastWorkedDate, todayDate);
  if (gap <= 1) return "activa";
  return gap <= STREAK_GRACE_DAYS ? "en_peligro" : "apagada";
}

/**
 * Racha que se muestra: con la racha apagada es 0 aunque `streak_count`
 * guarde todavía el número viejo (ver `streakStatus`).
 */
export function visibleStreak(streakCount: number, status: StreakStatus) {
  return status === "apagada" ? 0 : Math.max(0, Math.floor(streakCount));
}

/**
 * Niveles del poste. Son de la racha, no de la liga de cortes de
 * `@/lib/levels`: premian la constancia, no el volumen.
 */
export type StreakTier = "acero" | "oro" | "encendido";

export const STREAK_TIER_LABELS: Record<StreakTier, string> = {
  acero: "Acero",
  oro: "Oro",
  encendido: "Encendido",
};

/** Días de racha desde los que arranca cada nivel. */
export const STREAK_TIER_FROM: Record<StreakTier, number> = {
  acero: 0,
  oro: 7,
  encendido: 30,
};

export function streakTier(streak: number): StreakTier {
  if (streak >= STREAK_TIER_FROM.encendido) return "encendido";
  if (streak >= STREAK_TIER_FROM.oro) return "oro";
  return "acero";
}

/** Siguiente nivel y cuántos días faltan, o null en el último. */
export function nextStreakTier(
  streak: number,
): { tier: StreakTier; daysLeft: number } | null {
  const tier = streakTier(streak);
  if (tier === "encendido") return null;
  const next: StreakTier = tier === "acero" ? "oro" : "encendido";
  return { tier: next, daysLeft: STREAK_TIER_FROM[next] - streak };
}
