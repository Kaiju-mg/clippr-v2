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
