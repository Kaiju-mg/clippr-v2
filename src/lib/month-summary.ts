/**
 * El "ticket del mes" del barbero (spec 10, fase 4): cortes, servicio más
 * pedido, mejor día y racha más larga del mes anterior. Lógica pura: la
 * llama el servidor con las filas ya leídas (regla 1 de CLAUDE.md), así los
 * casos borde se testean sin mockear Supabase.
 */
import { countCutsByService, type ServiceCount } from "@/lib/share-day";
import { nextStreakCount } from "@/lib/streaks";

/** Hasta qué día del mes se muestra el ticket del mes anterior. */
export const MONTH_TICKET_LAST_DAY = 7;

export interface MonthCut {
  /** Día del negocio del corte (por `start_time`, como la agenda). */
  dateISO: string;
  serviceName: string | null;
}

export interface MonthSummary {
  /** Primer día del mes resumido (`AAAA-MM-01`). */
  monthStartISO: string;
  cuts: number;
  topService: ServiceCount | null;
  bestDay: { dateISO: string; cuts: number } | null;
  /** Racha más larga del mes, con la misma regla del día de gracia. */
  longestStreak: number;
  /** Todo lo cobrado en el mes (cortes + ventas + manuales). */
  income: number;
}

/** ¿Hoy se muestra el ticket del mes anterior? (días 1 a 7). */
export function showsMonthTicket(todayISO: string): boolean {
  return Number(todayISO.slice(8, 10)) <= MONTH_TICKET_LAST_DAY;
}

/**
 * Racha más larga en una lista de días trabajados (cajas cerradas con al
 * menos un cobro). Recorre los días en orden con `nextStreakCount`, la misma
 * función que actualiza `users.streak_count` al cerrar: un día de gracia no
 * corta, dos sí, y el mismo día repetido no suma.
 */
export function longestStreak(workedDates: readonly string[]): number {
  const days = [...new Set(workedDates)].sort();
  let streak = 0;
  let longest = 0;
  let last: string | null = null;
  for (const day of days) {
    streak = nextStreakCount(streak, last, day, false);
    longest = Math.max(longest, streak);
    last = day;
  }
  return longest;
}

/**
 * El día con más cortes. A igual cantidad gana el primero: así el ticket sale
 * igual cada vez que se mira.
 */
export function bestDay(
  cuts: readonly MonthCut[],
): { dateISO: string; cuts: number } | null {
  const byDay = new Map<string, number>();
  for (const cut of cuts) {
    byDay.set(cut.dateISO, (byDay.get(cut.dateISO) ?? 0) + 1);
  }
  let best: { dateISO: string; cuts: number } | null = null;
  for (const [dateISO, count] of [...byDay.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!best || count > best.cuts) best = { dateISO, cuts: count };
  }
  return best;
}

export function summarizeMonth(
  monthStartISO: string,
  cuts: readonly MonthCut[],
  workedDates: readonly string[],
  income: number,
): MonthSummary {
  const services = countCutsByService(
    cuts.map((cut) => ({ services: { name: cut.serviceName } })),
  );
  return {
    monthStartISO,
    cuts: cuts.length,
    topService: services[0] ?? null,
    bestDay: bestDay(cuts),
    longestStreak: longestStreak(workedDates),
    income,
  };
}
