"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessDateOf, businessRangeUtc, shiftDateISO } from "@/lib/dates";
import { LEVEL_WINDOW_DAYS, levelForCuts } from "@/lib/levels";
import { nextStreakCount } from "@/lib/streaks";
import {
  businessDatesWithIncome,
  CAJAS_CERRADAS_A_REVISAR,
} from "@/lib/streak-days";
import {
  CAJA_INVALIDA,
  CANTIDAD_INVALIDA,
  PRODUCTO_INVALIDO,
  SIN_SESION,
  STOCK_INSUFICIENTE,
  UNIQUE_VIOLATION,
} from "@/lib/db-errors";
import type { CashSession, Transaction, TransactionType } from "@/types";

export type CashActionResult<T> =
  { success: true; data: T } | { success: false; error: string };

/** Racha antes y después de un cierre, tal como la ve el barbero. */
export interface StreakChange {
  previous: number;
  current: number;
}

export interface CloseCashResult {
  session: CashSession;
  /** null si la racha no se tocó (caja sin cobros) o no se pudo guardar. */
  streak: StreakChange | null;
}

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";
const MENSAJE_CAJA_YA_ABIERTA = "Ya tenés una caja abierta.";
const MENSAJE_NO_ENCONTRADA = "Caja no encontrada o ya cerrada.";
const MENSAJE_SALDO_INVALIDO =
  "El saldo inicial debe ser un número mayor o igual a cero.";

const MENSAJE_CAJA_CERRADA =
  "Tenés que abrir tu caja antes de registrar movimientos.";
const MENSAJE_PRODUCTO_INVALIDO = "Producto no encontrado o inactivo.";

function validateInitialBalance(value: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return MENSAJE_SALDO_INVALIDO;
  }
  return null;
}

/**
 * id (public.users) del usuario autenticado que ejecuta la acción. Se usa
 * para acotar la búsqueda de "mi caja abierta" a la propia: dentro de la
 * misma barbería puede haber varias cajas abiertas a la vez (una por
 * barbero) y acá solo importa la del que está mirando la pantalla.
 */
async function getCurrentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle<{ id: string }>();

  return data?.id ?? null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface CashBalance {
  income: number;
  expense: number;
  current: number;
}

/**
 * Saldo de una caja = inicial + ingresos − egresos, calculado siempre en el
 * servidor (regla 1 de CLAUDE.md). Lo usan tanto la pantalla de caja como el
 * cierre, así lo que el barbero ve y lo que queda guardado nunca difieren.
 * RLS (`transactions_select_own`) ya limita a las transacciones de cajas
 * propias. Devuelve null si falla la consulta.
 */
async function computeBalance(
  supabase: SupabaseServerClient,
  sessionId: string,
  initialBalance: number,
): Promise<CashBalance | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("cash_session_id", sessionId);

  if (error) {
    console.error("computeBalance:", error.message);
    return null;
  }

  let income = 0;
  let expense = 0;
  for (const row of (data ?? []) as { type: string; amount: number }[]) {
    if (row.type === "income") income += Number(row.amount);
    else if (row.type === "expense") expense += Number(row.amount);
  }

  return {
    income,
    expense,
    current: Number(initialBalance) + income - expense,
  };
}

/**
 * Actualiza `streak_count` y `level` del barbero al cerrar una caja con
 * actividad (spec 08, sección 3). Toda esta lógica vive en el servidor: en
 * la v1 la racha se calculaba en el frontend y cualquiera podía inflarla
 * alterando la petición (ver docs/aprendizajes-v1.md).
 *
 * - **Racha:** una jornada cuenta si el barbero cerró una caja con al menos
 *   un ingreso. Se compara el día del negocio (`start_time`, no `end_time`:
 *   cerrar a las 2 AM sigue siendo la jornada anterior — caso borde 3 de la
 *   spec) contra la última jornada válida anterior, con un día de gracia
 *   (ver `@/lib/streaks`).
 * - **Nivel:** "liga" según los cortes de los últimos 30 días móviles, así
 *   que puede subir *y* bajar (ver `@/lib/levels`).
 *
 * No devuelve error: si algo falla acá, la caja ya quedó cerrada y correcta.
 * Se loguea y se sigue — perder un punto de racha no justifica hacerle creer
 * al barbero que el cierre no se guardó. Devuelve de cuánto a cuánto pasó la
 * racha (para la hoja del poste en /caja), o null si no se tocó o falló.
 */
async function updateStreakAndLevel(
  supabase: SupabaseServerClient,
  closedSession: CashSession,
  incomeOfSession: number,
): Promise<StreakChange | null> {
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, streak_count, level")
    .eq("id", closedSession.user_id)
    .maybeSingle<{ id: string; streak_count: number; level: string }>();

  if (profileError || !profile) {
    console.error(
      "updateStreakAndLevel (users):",
      profileError?.message ?? "perfil no encontrado",
    );
    return null;
  }

  const today = businessDateOf(new Date(closedSession.start_time));

  // Nivel: cortes completados en la ventana móvil, incluyendo hoy.
  const windowRange = businessRangeUtc(
    shiftDateISO(today, -(LEVEL_WINDOW_DAYS - 1)),
    today,
  );

  const { count: windowCuts, error: cutsError } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("status", "completed")
    .gte("start_time", windowRange.start)
    .lt("start_time", windowRange.end);

  if (cutsError) {
    console.error("updateStreakAndLevel (appointments):", cutsError.message);
    return null;
  }

  const level = levelForCuts(windowCuts ?? 0);

  // Una caja sin un solo ingreso no es una jornada trabajada: no suma ni
  // rompe la racha, pero el nivel igual se recalcula.
  if (incomeOfSession <= 0) {
    await applyStreakAndLevel(profile.id, profile.streak_count, level);
    return null;
  }

  const { data: previous, error: previousError } = await supabase
    .from("cash_sessions")
    .select("id, start_time")
    .eq("user_id", profile.id)
    .eq("status", "closed")
    .neq("id", closedSession.id)
    .order("start_time", { ascending: false })
    .limit(CAJAS_CERRADAS_A_REVISAR);

  if (previousError) {
    console.error(
      "updateStreakAndLevel (cash_sessions):",
      previousError.message,
    );
    return null;
  }

  const previousSessions = (previous ?? []) as {
    id: string;
    start_time: string;
  }[];

  const qualifyingDates = await businessDatesWithIncome(
    supabase,
    previousSessions,
  );

  if (qualifyingDates === null) return null;

  const sameDayAlreadyCounted = qualifyingDates.includes(today);
  const earlierDates = qualifyingDates.filter((date) => date < today);
  const lastWorkedDate =
    earlierDates.length > 0
      ? earlierDates.reduce((latest, date) => (date > latest ? date : latest))
      : null;

  const streak = nextStreakCount(
    profile.streak_count,
    lastWorkedDate,
    today,
    sameDayAlreadyCounted,
  );

  const saved = await applyStreakAndLevel(profile.id, streak, level);
  // Si no se guardó, no se festeja: la hoja del poste mostraría un número
  // que la base no tiene.
  if (!saved) return null;

  // "Antes" es lo que el barbero veía: si subió, el número anterior; si la
  // racha se había cortado y vuelve a 1, veía 0 (ver `visibleStreak`); si
  // no cambió (segunda caja del día), el mismo.
  const previousVisible =
    streak > profile.streak_count
      ? streak - 1
      : streak === 1 && profile.streak_count !== 1
        ? 0
        : streak;

  return { previous: previousVisible, current: streak };
}

/**
 * Escribe la racha y el nivel calculados. Desde la spec 09 (paso 2) esto va
 * con el cliente `service_role` y no con la sesión del barbero: `users` dejó
 * de aceptar updates de `streak_count`/`level` desde `authenticated` (ver
 * `20260920010000_users_update_hardening.sql`), justamente para que nadie
 * pueda inflarse la racha desde la consola del navegador. La key de servicio
 * nunca sale del servidor, así que el cálculo y la escritura quedan los dos
 * de este lado (regla 1 de CLAUDE.md).
 *
 * Los cálculos de arriba siguen usando la sesión del usuario, acotados por
 * RLS: sólo la escritura final necesita el privilegio extra.
 *
 * El try/catch no es decorativo: `createAdminClient()` tira si falta
 * `SUPABASE_SERVICE_ROLE_KEY`, y sin él esa excepción subiría hasta
 * `closeCashSessionAction` y le diría al barbero que el cierre falló cuando
 * la caja ya está cerrada y con el saldo correcto en la base. La regla de la
 * spec 08 sigue valiendo: perder un punto de racha nunca puede tumbar un
 * cierre.
 */
async function applyStreakAndLevel(
  userId: string,
  streakCount: number,
  level: string,
): Promise<boolean> {
  try {
    const { error } = await createAdminClient()
      .from("users")
      .update({ streak_count: streakCount, level })
      .eq("id", userId);

    if (error) {
      console.error("applyStreakAndLevel:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("applyStreakAndLevel:", error);
    return false;
  }
}

/**
 * Saldo actual de una caja propia. Si el id no es una caja del usuario
 * (RLS), se trata como no encontrada.
 */
export async function getCashBalanceAction(
  sessionId: string,
): Promise<CashActionResult<CashBalance>> {
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("cash_sessions")
    .select("initial_balance")
    .eq("id", sessionId)
    .maybeSingle<Pick<CashSession, "initial_balance">>();

  if (error) {
    console.error("getCashBalanceAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!session) {
    return { success: false, error: MENSAJE_NO_ENCONTRADA };
  }

  const balance = await computeBalance(
    supabase,
    sessionId,
    session.initial_balance,
  );

  if (!balance) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return { success: true, data: balance };
}

/** Cuántos movimientos entran en la lista de la pantalla de caja. */
const MOVIMIENTOS_VISIBLES = 8;

/**
 * Últimos movimientos de una caja propia, del más nuevo al más viejo. Es
 * sólo lectura, para la lista de la pantalla: el saldo sigue saliendo de
 * `getCashBalanceAction`, que suma en el servidor, y nunca de sumar esta
 * lista en el cliente (regla 1 de CLAUDE.md) — entre otras cosas porque
 * está recortada a los últimos ocho.
 *
 * No repite el filtro por usuario: `transactions_select_own` resuelve el
 * aislamiento con un EXISTS contra la `cash_session` referenciada, así que
 * pedir una `cash_session_id` ajena no devuelve filas. Ojo que ese atajo
 * **no** vale para `appointments` ni `cash_sessions`, donde la spec 08
 * abrió el select al dueño (ver docs/deuda-tecnica.md).
 */
export async function getCashMovementsAction(
  sessionId: string,
): Promise<CashActionResult<Transaction[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, cash_session_id, type, category, amount, description, created_at",
    )
    .eq("cash_session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(MOVIMIENTOS_VISIBLES);

  if (error) {
    console.error("getCashMovementsAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return { success: true, data: (data ?? []) as Transaction[] };
}

/**
 * Devuelve la caja abierta del usuario autenticado, o null si no tiene
 * ninguna. No filtra por barbershop_id a mano: RLS
 * (`cash_sessions_select_same_barbershop`) es la barrera de tenant.
 */
export async function getCurrentCashSessionAction(): Promise<
  CashActionResult<CashSession | null>
> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const { data, error } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();

  if (error) {
    console.error("getCurrentCashSessionAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return { success: true, data: data as CashSession | null };
}

/**
 * Abre una caja para el usuario autenticado con el saldo inicial dado. No
 * manda user_id ni barbershop_id: ambos se completan solos vía
 * `default current_user_id()` / `default current_barbershop_id()` en la
 * migración, así el cliente no puede abrir una caja a nombre de otro.
 *
 * La barrera real contra dobles cajas es el índice único parcial
 * `one_open_session_per_user` (ver migración): si un doble toque en un
 * celular con mal internet dispara la acción dos veces, el segundo insert
 * choca contra el índice y acá lo traducimos a un mensaje entendible en vez
 * de dejar pasar un error 500.
 */
export async function openCashSessionAction(
  initialBalance: number,
): Promise<CashActionResult<CashSession>> {
  const validationError = validateInitialBalance(initialBalance);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();

  const { data: created, error } = await supabase
    .from("cash_sessions")
    .insert({ initial_balance: initialBalance })
    .select()
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { success: false, error: MENSAJE_CAJA_YA_ABIERTA };
    }
    console.error("openCashSessionAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  revalidatePath("/caja");
  return { success: true, data: created as CashSession };
}

/**
 * Cierra una caja guardando como `final_balance` el saldo real (inicial +
 * ingresos − egresos, ver `computeBalance`). Si no se pueden leer las
 * transacciones, no se cierra: mejor un error que un cierre con un saldo
 * equivocado. `end_time` se
 * calcula acá, en el servidor: nunca hay que confiar en un timestamp
 * mandado desde un componente cliente, porque el celular del barbero puede
 * tener la hora mal configurada.
 *
 * No filtra por user_id/barbershop_id a mano en el update: si el id
 * pertenece a la caja de otro barbero (o de otro tenant), la política
 * `cash_sessions_update_own` de RLS hace que la fila no matchee y no se
 * actualice nada. Eso se trata como "no encontrada", igual que en
 * service.actions.ts.
 */
export async function closeCashSessionAction(
  sessionId: string,
): Promise<CashActionResult<CloseCashResult>> {
  const supabase = await createClient();

  const { data: session, error: fetchError } = await supabase
    .from("cash_sessions")
    .select("initial_balance, status")
    .eq("id", sessionId)
    .maybeSingle<Pick<CashSession, "initial_balance" | "status">>();

  if (fetchError) {
    console.error("closeCashSessionAction:", fetchError.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!session || session.status !== "open") {
    return { success: false, error: MENSAJE_NO_ENCONTRADA };
  }

  const balance = await computeBalance(
    supabase,
    sessionId,
    session.initial_balance,
  );

  if (!balance) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const { data: updated, error } = await supabase
    .from("cash_sessions")
    .update({
      status: "closed",
      end_time: new Date().toISOString(),
      final_balance: balance.current,
    })
    .eq("id", sessionId)
    .eq("status", "open")
    .select()
    .maybeSingle();

  if (error) {
    console.error("closeCashSessionAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!updated) {
    return { success: false, error: MENSAJE_NO_ENCONTRADA };
  }

  const closed = updated as CashSession;

  // Gamificación después del cierre, nunca antes: si la racha fallara, la
  // caja ya está cerrada con su saldo correcto.
  const streak = await updateStreakAndLevel(supabase, closed, balance.income);

  revalidatePath("/caja");
  revalidatePath("/inicio");
  revalidatePath("/estadisticas");
  return { success: true, data: { session: closed, streak } };
}

/**
 * id de la caja abierta del usuario autenticado, o null si no tiene. Los
 * movimientos manuales y las ventas se asocian siempre a esta caja, resuelta
 * en el servidor: el cliente nunca elige en qué caja se carga la plata.
 * Si igual se llegara a insertar sobre una caja cerrada, RLS
 * (`transactions_insert_own`, que exige `status = 'open'`) lo rechaza.
 */
async function getOpenCashSessionId(
  supabase: SupabaseServerClient,
): Promise<{ id: string | null; error: boolean }> {
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { id: null, error: true };

  const { data, error } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("getOpenCashSessionId:", error.message);
    return { id: null, error: true };
  }

  return { id: data?.id ?? null, error: false };
}

export interface ManualTransactionPayload {
  type: TransactionType;
  amount: number;
  description: string;
}

function validateManualTransaction(
  payload: ManualTransactionPayload,
): string | null {
  if (payload.type !== "income" && payload.type !== "expense") {
    return "El tipo de movimiento no es válido.";
  }

  if (
    typeof payload.amount !== "number" ||
    !Number.isInteger(payload.amount) ||
    payload.amount <= 0
  ) {
    return "El monto debe ser un número entero mayor a cero.";
  }

  if (
    typeof payload.description !== "string" ||
    payload.description.trim().length === 0
  ) {
    return "Contá brevemente de qué es el movimiento.";
  }

  return null;
}

/**
 * Registra un ingreso o egreso manual (ej. comprar café, una propina) en la
 * caja abierta del usuario. Entra solo en el saldo porque `computeBalance`
 * ya suma todas las `transactions` de la caja.
 *
 * Va con `category: "manual"` (spec 09, paso 3): una propina no es un corte,
 * así que no tiene por qué entrar en el ticket promedio del dueño.
 */
export async function registerTransactionAction(
  payload: ManualTransactionPayload,
): Promise<CashActionResult<Transaction>> {
  const validationError = validateManualTransaction(payload);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();
  const session = await getOpenCashSessionId(supabase);

  if (session.error) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!session.id) {
    return { success: false, error: MENSAJE_CAJA_CERRADA };
  }

  const { data: created, error } = await supabase
    .from("transactions")
    .insert({
      cash_session_id: session.id,
      type: payload.type,
      category: "manual",
      amount: payload.amount,
      description: payload.description.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error("registerTransactionAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  revalidatePath("/caja");
  return { success: true, data: created as Transaction };
}

export interface SellProductPayload {
  productId: string;
  quantity: number;
}

/**
 * Mensaje de stock insuficiente a partir del error del RPC: el nombre del
 * producto viaja en `message` y el stock restante en `details` (ver el
 * `raise` de `sell_product_and_charge`). La copia se arma acá y no en la
 * base: el texto que lee el barbero es cosa de la aplicación.
 */
function mensajeDeStock(name: string, details: unknown): string {
  const stock = Number(details);
  if (!Number.isFinite(stock) || stock <= 0) {
    return `No queda stock de ${name}.`;
  }
  return `No hay stock suficiente de ${name} (quedan ${stock}).`;
}

/**
 * Vende un producto: descuenta stock e inserta el ingreso en la caja abierta,
 * en una sola llamada al RPC `sell_product_and_charge` (migración
 * 20260920000000). Antes eran dos queries separadas y si el insert de la
 * transacción fallaba quedaba stock descontado sin venta; ahora las dos
 * escrituras van dentro de la misma transacción de Postgres y cualquier
 * error las revierte (spec 09, paso 1).
 *
 * El `for update` del RPC también reemplaza al viejo update condicionado al
 * stock leído: dos ventas simultáneas del último producto ya no compiten por
 * la misma fila, la segunda espera y recién ahí lee el stock real. Eso saca
 * de encima el "El stock cambió mientras vendías. Intentá de nuevo." que
 * antes aparecía por una carrera que ahora no existe.
 *
 * El monto sigue saliendo de `products.price`, leído por el RPC dentro de la
 * transacción — nunca del payload. La caja tampoco la elige el cliente: se
 * resuelve acá con `getOpenCashSessionId` y el RPC igual revalida que sea
 * propia y esté abierta.
 */
export async function sellProductAction(
  payload: SellProductPayload,
): Promise<CashActionResult<Transaction>> {
  if (!Number.isInteger(payload.quantity) || payload.quantity <= 0) {
    return {
      success: false,
      error: "La cantidad debe ser un número entero mayor a cero.",
    };
  }

  const supabase = await createClient();
  const session = await getOpenCashSessionId(supabase);

  if (session.error) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!session.id) {
    return { success: false, error: MENSAJE_CAJA_CERRADA };
  }

  const { data, error } = await supabase
    .rpc("sell_product_and_charge", {
      p_product_id: payload.productId,
      p_cash_session_id: session.id,
      p_quantity: payload.quantity,
    })
    .single();

  if (error) {
    switch (error.code) {
      case CAJA_INVALIDA:
      case SIN_SESION:
        return { success: false, error: MENSAJE_CAJA_CERRADA };
      case PRODUCTO_INVALIDO:
        return { success: false, error: MENSAJE_PRODUCTO_INVALIDO };
      case STOCK_INSUFICIENTE:
        return {
          success: false,
          error: mensajeDeStock(error.message, error.details),
        };
      case CANTIDAD_INVALIDA:
        return {
          success: false,
          error: "La cantidad debe ser un número entero mayor a cero.",
        };
      default:
        console.error("sellProductAction:", error.message);
        return { success: false, error: MENSAJE_ERROR_GENERICO };
    }
  }

  revalidatePath("/caja");
  revalidatePath("/productos");
  return { success: true, data: data as Transaction };
}
