/**
 * Tarjeta de sellos de la racha (spec 10, fase 4): un casillero por día del
 * mes; cada día trabajado (caja cerrada con al menos un cobro, el mismo
 * criterio que la racha) lleva un sello, y los días en que la racha llegó a
 * 7 y a 30 marcan el poste de oro y el encendido. Sin reglas nuevas: la
 * racha de cada día sale de `nextStreakCount`, igual que `users.streak_count`.
 *
 * Lógica pura; los días trabajados los lee el servidor.
 */
import { daysBetweenDateISO, shiftDateISO } from "@/lib/dates";
import {
  STREAK_TIER_FROM,
  nextStreakCount,
  type StreakTier,
} from "@/lib/streaks";

/**
 * Días hacia atrás desde el 1° del mes que se miran para saber con cuánta
 * racha arrancó el mes. Una racha que viene de más atrás que esto se cuenta
 * desde el borde de la ventana: el día 7 o 30 que marque puede no ser el
 * real, pero con 90 días eso sólo pasa con rachas de más de tres meses.
 */
export const STAMP_CARD_LOOKBACK_DAYS = 90;

export interface StampDay {
  dateISO: string;
  /** Día del mes, 1 a 31. */
  day: number;
  worked: boolean;
  /** Racha al terminar ese día; 0 si no se trabajó. */
  streak: number;
  /** El día en que la racha llegó justo a 7 (oro) o a 30 (encendido). */
  milestone: Exclude<StreakTier, "acero"> | null;
  isToday: boolean;
  isFuture: boolean;
}

/** Último día del mes de `monthStartISO` (`AAAA-MM-01`). */
export function monthEnd(monthStartISO: string): string {
  const [year, month] = monthStartISO.split("-").map(Number);
  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return shiftDateISO(nextMonth, -1);
}

/**
 * Racha al final de cada día trabajado, recorriendo los días en orden con la
 * regla del día de gracia. Los días repetidos cuentan una vez.
 */
export function streakByDay(
  workedDates: readonly string[],
): Map<string, number> {
  const days = [...new Set(workedDates)].sort();
  const byDay = new Map<string, number>();
  let streak = 0;
  let last: string | null = null;
  for (const day of days) {
    streak = nextStreakCount(streak, last, day, false);
    byDay.set(day, streak);
    last = day;
  }
  return byDay;
}

export function stampCardDays(
  monthStartISO: string,
  todayISO: string,
  workedDates: readonly string[],
): StampDay[] {
  const streaks = streakByDay(workedDates);
  const total = daysBetweenDateISO(monthStartISO, monthEnd(monthStartISO)) + 1;

  return Array.from({ length: total }, (_, index) => {
    const dateISO = shiftDateISO(monthStartISO, index);
    const streak = streaks.get(dateISO) ?? 0;
    return {
      dateISO,
      day: index + 1,
      worked: streak > 0,
      streak,
      milestone:
        streak === STREAK_TIER_FROM.encendido
          ? "encendido"
          : streak === STREAK_TIER_FROM.oro
            ? "oro"
            : null,
      isToday: dateISO === todayISO,
      isFuture: dateISO > todayISO,
    };
  });
}

/**
 * Columna (0 = lunes … 6 = domingo) del 1° del mes, para dejar huecos al
 * principio de la grilla. Semana del negocio de lunes a domingo, como "esta
 * semana" en las estadísticas del dueño.
 */
export function mondayOffset(monthStartISO: string): number {
  // `getUTCDay` sobre la fecha calendario: 0 = domingo.
  const weekday = new Date(`${monthStartISO}T00:00:00.000Z`).getUTCDay();
  return (weekday + 6) % 7;
}
