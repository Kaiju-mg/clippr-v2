"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CashSession } from "@/types";

export type CashActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";
const MENSAJE_CAJA_YA_ABIERTA = "Ya tenés una caja abierta.";
const MENSAJE_NO_ENCONTRADA = "Caja no encontrada o ya cerrada.";
const MENSAJE_SALDO_INVALIDO =
  "El saldo inicial debe ser un número mayor o igual a cero.";

// Código SQLSTATE de Postgres para violación de restricción única (el
// índice parcial one_open_session_per_user de la migración).
const UNIQUE_VIOLATION = "23505";

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
): Promise<CashActionResult<CashSession>> {
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

  revalidatePath("/caja");
  return { success: true, data: updated as CashSession };
}
