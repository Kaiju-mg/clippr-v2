"use server";

import { createClient } from "@/lib/supabase/server";
import {
  businessDayRangeUtc,
  businessRangeUtc,
  daysBetweenDateISO,
  isValidDateISO,
  shiftDateISO,
} from "@/lib/dates";
import { LEVEL_WINDOW_DAYS, levelProgress, type LevelProgress } from "@/lib/levels";
import type { UserLevel } from "@/types";

export type StatsActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";
const MENSAJE_FECHA_INVALIDA = "La fecha no es válida.";
const MENSAJE_RANGO_INVALIDO = "El rango de fechas no es válido.";
const MENSAJE_ACCESO_DENEGADO =
  "Acceso denegado: solo el dueño puede ver las estadísticas de la barbería.";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface CurrentProfile {
  id: string;
  name: string;
  role: string;
  level: UserLevel;
  streak_count: number;
}

/**
 * Perfil (public.users) del usuario autenticado. Las estadísticas lo
 * necesitan entero: el id para acotar las consultas propias, el rol para el
 * control de acceso del dashboard del dueño, y level/streak porque son parte
 * de lo que se muestra.
 */
async function getCurrentProfile(
  supabase: SupabaseServerClient,
): Promise<CurrentProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, name, role, level, streak_count")
    .eq("auth_id", user.id)
    .maybeSingle<CurrentProfile>();

  return data ?? null;
}

/**
 * Cortes completados de un barbero en un rango. Se cuenta por `start_time`
 * (cuándo se hizo el corte), igual que la agenda — no por `end_time`, que en
 * un turno cobrado tarde caería en otro día. `head: true` pide solo el
 * count, sin traer las filas.
 */
async function countCompletedCuts(
  supabase: SupabaseServerClient,
  userId: string,
  range: { start: string; end: string },
): Promise<number | null> {
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("start_time", range.start)
    .lt("start_time", range.end);

  if (error) {
    console.error("countCompletedCuts:", error.message);
    return null;
  }

  return count ?? 0;
}

/**
 * Ingresos cobrados por cada barbero dentro de un rango. Son dos consultas
 * porque `transactions` no tiene columnas de tenant ni de usuario (solo
 * `cash_session_id`, ver el modelo en docs/arquitectura.md): primero las
 * cajas, para saber de quién es cada movimiento, después los movimientos.
 *
 * El recorte por fecha va sobre `transactions.created_at`, **no** sobre el
 * día de apertura de la caja. Una caja que se abrió anoche y sigue abierta
 * (o que el barbero se olvidó de cerrar) no tiene por qué sacar del día de
 * hoy lo que se cobró hoy: si no, la pantalla muestra "1 corte hoy" y
 * "Gs. 0 cobrado hoy" al mismo tiempo. Por eso las cajas se buscan por
 * intersección con el rango (arrancaron antes de que termine y no cerraron
 * antes de que empiece), no por día de apertura.
 *
 * Incluye todo lo cobrado (cortes, ventas de productos, ingresos manuales),
 * no solo los cortes: es "lo que entró a la caja", el mismo número que ve el
 * barbero en `/caja`.
 */
async function sumIncome(
  supabase: SupabaseServerClient,
  userIds: string[],
  range: { start: string; end: string },
): Promise<Map<string, number> | null> {
  const totals = new Map<string, number>();
  if (userIds.length === 0) return totals;

  const { data: sessions, error: sessionsError } = await supabase
    .from("cash_sessions")
    .select("id, user_id")
    .in("user_id", userIds)
    .lt("start_time", range.end)
    .or(`end_time.gte.${range.start},end_time.is.null`);

  if (sessionsError) {
    console.error("sumIncome (cash_sessions):", sessionsError.message);
    return null;
  }

  const sessionRows = (sessions ?? []) as { id: string; user_id: string }[];
  // Sin cajas que toquen el rango no hay nada que sumar; además, un `.in()`
  // con una lista vacía es una consulta que no hace falta pagar.
  if (sessionRows.length === 0) return totals;

  const ownerOfSession = new Map(
    sessionRows.map((session) => [session.id, session.user_id]),
  );

  const { data: transactions, error: transactionsError } = await supabase
    .from("transactions")
    .select("cash_session_id, amount")
    .eq("type", "income")
    .gte("created_at", range.start)
    .lt("created_at", range.end)
    .in(
      "cash_session_id",
      sessionRows.map((session) => session.id),
    );

  if (transactionsError) {
    console.error("sumIncome (transactions):", transactionsError.message);
    return null;
  }

  for (const row of (transactions ?? []) as {
    cash_session_id: string;
    amount: number;
  }[]) {
    const userId = ownerOfSession.get(row.cash_session_id);
    if (!userId) continue;
    totals.set(userId, (totals.get(userId) ?? 0) + Number(row.amount));
  }

  return totals;
}

export interface BarberStats {
  dateISO: string;
  /** Cortes completados en el día pedido. */
  completedCuts: number;
  /** Lo cobrado en el día pedido (cortes + ventas + ingresos manuales). */
  income: number;
  streakCount: number;
  level: UserLevel;
  /** Cortes de los últimos 30 días y avance hacia el nivel siguiente. */
  progress: LevelProgress;
}

/**
 * Métricas del barbero autenticado para un día. Las usa tanto `/inicio`
 * (píldoras de cortes y racha) como su dashboard de `/estadisticas`.
 *
 * El día se corta en la zona del negocio (`America/Asuncion`), nunca en UTC
 * (caso borde 1 de la spec): un corte de las 21:30 pertenece al día de
 * Paraguay, no al día siguiente de UTC.
 */
export async function getBarberStatsAction(
  dateISO: string,
): Promise<StatsActionResult<BarberStats>> {
  if (!isValidDateISO(dateISO)) {
    return { success: false, error: MENSAJE_FECHA_INVALIDA };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const dayRange = businessDayRangeUtc(dateISO);
  // Ventana móvil del nivel: los últimos 30 días *incluyendo* el pedido.
  const windowRange = businessRangeUtc(
    shiftDateISO(dateISO, -(LEVEL_WINDOW_DAYS - 1)),
    dateISO,
  );

  const [dayCuts, windowCuts, incomeByUser] = await Promise.all([
    countCompletedCuts(supabase, profile.id, dayRange),
    countCompletedCuts(supabase, profile.id, windowRange),
    sumIncome(supabase, [profile.id], dayRange),
  ]);

  if (dayCuts === null || windowCuts === null || incomeByUser === null) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return {
    success: true,
    data: {
      dateISO,
      completedCuts: dayCuts,
      income: incomeByUser.get(profile.id) ?? 0,
      streakCount: profile.streak_count,
      level: profile.level,
      progress: levelProgress(windowCuts),
    },
  };
}

export interface BarberPerformance {
  userId: string;
  name: string;
  cuts: number;
  income: number;
}

export interface OwnerStats {
  startDateISO: string;
  endDateISO: string;
  /** Días del rango, inclusive. Nunca es 0 (se valida el rango antes). */
  days: number;
  totalIncome: number;
  totalCuts: number;
  /** Ingreso promedio por día del rango. */
  dailyAverageIncome: number;
  /** Equipo ordenado por ingresos, de mayor a menor. */
  leaderboard: BarberPerformance[];
}

/**
 * Métricas de toda la barbería para un rango de días. Solo para el dueño: se
 * valida el rol acá además de la RLS (caso borde 4 de la spec), porque un
 * barbero que llame a esta acción directamente no tiene por qué ver lo que
 * cobran sus compañeros.
 *
 * La RLS nueva (`20260917000000_owner_stats_visibility.sql`) es la que deja
 * al dueño leer los turnos, cajas y movimientos del equipo — acá no se
 * filtra `barbershop_id` a mano (regla 2 de CLAUDE.md).
 */
export async function getOwnerStatsAction(
  startDateISO: string,
  endDateISO: string,
): Promise<StatsActionResult<OwnerStats>> {
  if (!isValidDateISO(startDateISO) || !isValidDateISO(endDateISO)) {
    return { success: false, error: MENSAJE_FECHA_INVALIDA };
  }

  const days = daysBetweenDateISO(startDateISO, endDateISO) + 1;
  if (days <= 0) {
    return { success: false, error: MENSAJE_RANGO_INVALIDO };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (profile.role !== "owner") {
    return { success: false, error: MENSAJE_ACCESO_DENEGADO };
  }

  const range = businessRangeUtc(startDateISO, endDateISO);

  const { data: team, error: teamError } = await supabase
    .from("users")
    .select("id, name")
    .order("name");

  if (teamError) {
    console.error("getOwnerStatsAction (users):", teamError.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const teamRows = (team ?? []) as { id: string; name: string }[];
  const userIds = teamRows.map((member) => member.id);

  const [cutsResult, incomeByUser] = await Promise.all([
    supabase
      .from("appointments")
      .select("user_id")
      .eq("status", "completed")
      .gte("start_time", range.start)
      .lt("start_time", range.end),
    sumIncome(supabase, userIds, range),
  ]);

  if (cutsResult.error) {
    console.error(
      "getOwnerStatsAction (appointments):",
      cutsResult.error.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (incomeByUser === null) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const cutsByUser = new Map<string, number>();
  for (const row of (cutsResult.data ?? []) as { user_id: string }[]) {
    cutsByUser.set(row.user_id, (cutsByUser.get(row.user_id) ?? 0) + 1);
  }

  const leaderboard: BarberPerformance[] = teamRows
    .map((member) => ({
      userId: member.id,
      name: member.name,
      cuts: cutsByUser.get(member.id) ?? 0,
      income: incomeByUser.get(member.id) ?? 0,
    }))
    .sort((a, b) => b.income - a.income || b.cuts - a.cuts);

  const totalIncome = leaderboard.reduce(
    (total, member) => total + member.income,
    0,
  );
  const totalCuts = leaderboard.reduce(
    (total, member) => total + member.cuts,
    0,
  );

  return {
    success: true,
    data: {
      startDateISO,
      endDateISO,
      days,
      totalIncome,
      totalCuts,
      // `days` nunca es 0 (se validó arriba), pero la división queda
      // protegida igual: caso borde 2 de la spec.
      dailyAverageIncome: days > 0 ? Math.round(totalIncome / days) : 0,
      leaderboard,
    },
  };
}

/**
 * Rol del usuario autenticado, para que `/estadisticas` decida qué dashboard
 * renderizar sin duplicar la consulta a `users` en la página.
 */
export async function getCurrentRoleAction(): Promise<
  StatsActionResult<{ role: string; name: string }>
> {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return { success: true, data: { role: profile.role, name: profile.name } };
}
