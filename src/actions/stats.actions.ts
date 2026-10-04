"use server";

import { createClient } from "@/lib/supabase/server";
import {
  businessDateOf,
  businessDayRangeUtc,
  businessMonthStart,
  businessRangeUtc,
  daysBetweenDateISO,
  isValidDateISO,
  shiftDateISO,
} from "@/lib/dates";
import {
  LEVEL_WINDOW_DAYS,
  levelProgress,
  type LevelProgress,
} from "@/lib/levels";
import { summarizeCash, type CashSummary } from "@/lib/cash-summary";
import {
  showsMonthTicket,
  summarizeMonth,
  type MonthSummary,
} from "@/lib/month-summary";
import {
  STAMP_CARD_LOOKBACK_DAYS,
  stampCardDays,
  type StampDay,
} from "@/lib/stamp-card";
import { businessDatesWithIncome, lastWorkedDate } from "@/lib/streak-days";
import { streakStatus, visibleStreak, type StreakStatus } from "@/lib/streaks";
import type { UserLevel } from "@/types";

export type StatsActionResult<T> =
  { success: true; data: T } | { success: false; error: string };

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

export interface IncomeBreakdown {
  /** Todo lo que entró a la caja: cortes + ventas + ingresos manuales. */
  total: number;
  /** Sólo los cortes cobrados (`category = 'service'`). */
  service: number;
}

/**
 * Ingresos cobrados por cada barbero dentro de un rango, abiertos en "todo"
 * y "sólo cortes". Son dos consultas porque `transactions` no tiene columnas
 * de tenant ni de usuario (solo `cash_session_id`, ver el modelo en
 * docs/arquitectura.md): primero las cajas, para saber de quién es cada
 * movimiento, después los movimientos.
 *
 * El recorte por fecha va sobre `transactions.created_at`, **no** sobre el
 * día de apertura de la caja. Una caja que se abrió anoche y sigue abierta
 * (o que el barbero se olvidó de cerrar) no tiene por qué sacar del día de
 * hoy lo que se cobró hoy: si no, la pantalla muestra "1 corte hoy" y
 * "Gs. 0 cobrado hoy" al mismo tiempo. Por eso las cajas se buscan por
 * intersección con el rango (arrancaron antes de que termine y no cerraron
 * antes de que empiece), no por día de apertura.
 *
 * `service` sale de `transactions.category` (spec 09, paso 3) y no del
 * prefijo de la descripción: es lo que permite un ticket promedio que no
 * mezcle cortes con ventas de productos.
 */
async function sumIncome(
  supabase: SupabaseServerClient,
  userIds: string[],
  range: { start: string; end: string },
): Promise<Map<string, IncomeBreakdown> | null> {
  const totals = new Map<string, IncomeBreakdown>();
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
    .select("cash_session_id, amount, category")
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
    category: string;
  }[]) {
    const userId = ownerOfSession.get(row.cash_session_id);
    if (!userId) continue;
    const actual = totals.get(userId) ?? { total: 0, service: 0 };
    const amount = Number(row.amount);
    totals.set(userId, {
      total: actual.total + amount,
      service: actual.service + (row.category === "service" ? amount : 0),
    });
  }

  return totals;
}

export interface BarberStats {
  dateISO: string;
  /** Cortes completados en el día pedido. */
  completedCuts: number;
  /** Lo cobrado en el día pedido (cortes + ventas + ingresos manuales). */
  income: number;
  /**
   * Racha que se muestra: 0 si está apagada, aunque `users.streak_count`
   * guarde todavía el número viejo (ver `streakStatus`).
   */
  streakCount: number;
  /** Viva, en el día de gracia o apagada: decide cómo se ve el poste. */
  streakStatus: StreakStatus;
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

  // Después del Promise.all y no adentro: pega sobre cash_sessions y
  // transactions igual que sumIncome, y en serie el orden de las consultas
  // es predecible. Si falla, la racha se muestra como viva con el número
  // guardado: mejor no alarmar al barbero por un error de red.
  const lastDate = await lastWorkedDate(supabase, profile.id);
  const status: StreakStatus =
    lastDate === undefined
      ? profile.streak_count > 0
        ? "activa"
        : "apagada"
      : streakStatus(profile.streak_count, lastDate, dateISO);

  return {
    success: true,
    data: {
      dateISO,
      completedCuts: dayCuts,
      // El barbero ve "lo que entró a la caja" completo, igual que en
      // /caja: la separación por categoría es para el ticket promedio del
      // dueño, no para este número.
      income: incomeByUser.get(profile.id)?.total ?? 0,
      streakCount: visibleStreak(profile.streak_count, status),
      streakStatus: status,
      level: profile.level,
      progress: levelProgress(windowCuts),
    },
  };
}

export interface BarberPerformance {
  userId: string;
  name: string;
  cuts: number;
  /** Todo lo cobrado por esta persona: cortes + ventas + manuales. */
  income: number;
  /** Sólo los cortes, para no mezclar con las ventas de productos. */
  serviceIncome: number;
}

export interface OwnerStats {
  startDateISO: string;
  endDateISO: string;
  /** Días del rango, inclusive. Nunca es 0 (se valida el rango antes). */
  days: number;
  totalIncome: number;
  /** Parte de `totalIncome` que vino de cortes (`category = 'service'`). */
  totalServiceIncome: number;
  totalCuts: number;
  /** Ingreso promedio por día del rango. */
  dailyAverageIncome: number;
  /** Cortes / ingreso por corte: sólo cortes, nunca ventas ni propinas. */
  averageTicket: number;
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
    .map((member) => {
      const income = incomeByUser.get(member.id);
      return {
        userId: member.id,
        name: member.name,
        cuts: cutsByUser.get(member.id) ?? 0,
        income: income?.total ?? 0,
        serviceIncome: income?.service ?? 0,
      };
    })
    .sort((a, b) => b.income - a.income || b.cuts - a.cuts);

  const totalIncome = leaderboard.reduce(
    (total, member) => total + member.income,
    0,
  );
  const totalServiceIncome = leaderboard.reduce(
    (total, member) => total + member.serviceIncome,
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
      totalServiceIncome,
      totalCuts,
      // `days` nunca es 0 (se validó arriba), pero la división queda
      // protegida igual: caso borde 2 de la spec.
      dailyAverageIncome: days > 0 ? Math.round(totalIncome / days) : 0,
      // Sólo lo cobrado por cortes sobre la cantidad de cortes (spec 09,
      // paso 3). Con el total mezclado, una barbería que vende mucha cera
      // mostraba un "ticket promedio" que ningún cliente pagó nunca.
      averageTicket:
        totalCuts > 0 ? Math.round(totalServiceIncome / totalCuts) : 0,
      leaderboard,
    },
  };
}

export interface TeamClosure {
  sessionId: string;
  userId: string;
  barberName: string | null;
  /** `end_time` de la caja. */
  closedAt: string;
  /** Lo mismo que imprimió el ticket del cierre de ese barbero. */
  summary: CashSummary;
}

/**
 * "Cierres de hoy" del dueño (spec 10, fase 4): un ticket por cada caja que
 * se cerró en el día pedido, del primero al último. El resumen sale de
 * `summarizeCash`, la misma función del cierre: es exactamente el ticket que
 * vio el barbero al cerrar, y su TOTAL es el `final_balance` guardado.
 *
 * Una caja es del día de su `start_time` (la jornada), igual que la racha.
 * Sólo el dueño: la RLS de `cash_sessions`/`transactions` le deja leer las
 * de toda su barbería (spec 08), y no hay `WHERE barbershop_id` a mano
 * (regla 2). Acá no se filtra `user_id` porque se quieren las de todo el
 * equipo, justamente.
 */
export async function getTeamClosuresAction(
  dateISO: string,
): Promise<StatsActionResult<TeamClosure[]>> {
  if (!isValidDateISO(dateISO)) {
    return { success: false, error: MENSAJE_FECHA_INVALIDA };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (profile.role !== "owner") {
    return { success: false, error: MENSAJE_ACCESO_DENEGADO };
  }

  const range = businessDayRangeUtc(dateISO);

  const { data: sessions, error: sessionsError } = await supabase
    .from("cash_sessions")
    .select("id, user_id, end_time, initial_balance")
    .eq("status", "closed")
    .gte("start_time", range.start)
    .lt("start_time", range.end)
    .order("end_time", { ascending: true });

  if (sessionsError) {
    console.error(
      "getTeamClosuresAction (cash_sessions):",
      sessionsError.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const closed = (sessions ?? []) as {
    id: string;
    user_id: string;
    end_time: string | null;
    initial_balance: number;
  }[];

  if (closed.length === 0) return { success: true, data: [] };

  const [transactions, team] = await Promise.all([
    supabase
      .from("transactions")
      .select("cash_session_id, type, amount, category")
      .in(
        "cash_session_id",
        closed.map((session) => session.id),
      ),
    supabase.from("users").select("id, name"),
  ]);

  if (transactions.error || team.error) {
    console.error(
      "getTeamClosuresAction:",
      transactions.error?.message ?? team.error?.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const rowsBySession = new Map<
    string,
    { type: string; amount: number; category: string | null }[]
  >();
  for (const row of (transactions.data ?? []) as {
    cash_session_id: string;
    type: string;
    amount: number;
    category: string | null;
  }[]) {
    const rows = rowsBySession.get(row.cash_session_id) ?? [];
    rows.push(row);
    rowsBySession.set(row.cash_session_id, rows);
  }

  const names = new Map(
    ((team.data ?? []) as { id: string; name: string }[]).map((member) => [
      member.id,
      member.name,
    ]),
  );

  return {
    success: true,
    data: closed.map((session) => ({
      sessionId: session.id,
      userId: session.user_id,
      barberName: names.get(session.user_id) ?? null,
      closedAt: session.end_time ?? range.end,
      summary: summarizeCash(
        session.initial_balance,
        rowsBySession.get(session.id) ?? [],
      ),
    })),
  };
}

export interface MonthTicket {
  month: MonthSummary;
  barberName: string;
  /** Para la imagen de compartir: encabezado y "Turnos: …". */
  barbershopName: string;
  phone: string | null;
}

/**
 * El ticket del mes anterior del barbero autenticado (spec 10, fase 4). Sólo
 * en los primeros días del mes (`showsMonthTicket`) y sólo si ese mes tuvo
 * algún corte o algún día trabajado: si no, `null` y la pantalla no muestra
 * nada.
 *
 * Todo sale de acá (regla 1 de CLAUDE.md): los cortes por `start_time` como
 * la agenda, la racha más larga de las cajas cerradas con cobro del mes (la
 * regla del día de gracia de `src/lib/streaks.ts`) y lo cobrado con
 * `sumIncome`. `user_id` se filtra a mano en todas las consultas: la RLS ya
 * no acota esas tablas a lo propio para el dueño (spec 08), y el dueño
 * también tiene su ticket del mes.
 */
export async function getMonthTicketAction(
  todayISO: string,
): Promise<StatsActionResult<MonthTicket | null>> {
  if (!isValidDateISO(todayISO)) {
    return { success: false, error: MENSAJE_FECHA_INVALIDA };
  }

  if (!showsMonthTicket(todayISO)) return { success: true, data: null };

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const currentMonthStart = businessMonthStart(todayISO);
  const monthEnd = shiftDateISO(currentMonthStart, -1);
  const monthStart = businessMonthStart(monthEnd);
  const range = businessRangeUtc(monthStart, monthEnd);

  const [cutsResult, sessionsResult, incomeByUser, barbershopResult] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("start_time, services(name)")
        .eq("user_id", profile.id)
        .eq("status", "completed")
        .gte("start_time", range.start)
        .lt("start_time", range.end),
      supabase
        .from("cash_sessions")
        .select("id, start_time")
        .eq("user_id", profile.id)
        .eq("status", "closed")
        .gte("start_time", range.start)
        .lt("start_time", range.end),
      sumIncome(supabase, [profile.id], range),
      supabase
        .from("barbershops")
        .select("name, phone")
        .maybeSingle<{ name: string; phone: string | null }>(),
    ]);

  if (
    cutsResult.error ||
    sessionsResult.error ||
    incomeByUser === null ||
    barbershopResult.error
  ) {
    console.error(
      "getMonthTicketAction:",
      cutsResult.error?.message ??
        sessionsResult.error?.message ??
        barbershopResult.error?.message ??
        "sumIncome",
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const workedDates = await businessDatesWithIncome(
    supabase,
    (sessionsResult.data ?? []) as { id: string; start_time: string }[],
  );
  if (workedDates === null) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const cuts = (
    (cutsResult.data ?? []) as unknown as {
      start_time: string;
      services: { name: string | null } | null;
    }[]
  ).map((row) => ({
    dateISO: businessDateOf(new Date(row.start_time)),
    serviceName: row.services?.name ?? null,
  }));

  if (cuts.length === 0 && workedDates.length === 0) {
    return { success: true, data: null };
  }

  return {
    success: true,
    data: {
      month: summarizeMonth(
        monthStart,
        cuts,
        workedDates,
        incomeByUser.get(profile.id)?.total ?? 0,
      ),
      barberName: profile.name,
      barbershopName: barbershopResult.data?.name ?? "Clippr",
      phone: barbershopResult.data?.phone ?? null,
    },
  };
}

export interface StampCard {
  monthStartISO: string;
  days: StampDay[];
}

/**
 * Tarjeta de sellos del mes en curso del barbero autenticado (spec 10, fase
 * 4). Lee las cajas cerradas desde `STAMP_CARD_LOOKBACK_DAYS` antes del 1°
 * hasta hoy, para saber con cuánta racha arrancó el mes; los días trabajados
 * salen de `businessDatesWithIncome`, el mismo criterio de la racha. `user_id`
 * a mano: la RLS no acota `cash_sessions` a lo propio para el dueño.
 */
export async function getStampCardAction(
  todayISO: string,
): Promise<StatsActionResult<StampCard>> {
  if (!isValidDateISO(todayISO)) {
    return { success: false, error: MENSAJE_FECHA_INVALIDA };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const monthStart = businessMonthStart(todayISO);
  const range = businessRangeUtc(
    shiftDateISO(monthStart, -STAMP_CARD_LOOKBACK_DAYS),
    todayISO,
  );

  const { data, error } = await supabase
    .from("cash_sessions")
    .select("id, start_time")
    .eq("user_id", profile.id)
    .eq("status", "closed")
    .gte("start_time", range.start)
    .lt("start_time", range.end);

  if (error) {
    console.error("getStampCardAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const workedDates = await businessDatesWithIncome(
    supabase,
    (data ?? []) as { id: string; start_time: string }[],
  );
  if (workedDates === null) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return {
    success: true,
    data: {
      monthStartISO: monthStart,
      days: stampCardDays(monthStart, todayISO, workedDates),
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
