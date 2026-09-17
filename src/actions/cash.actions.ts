"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CashSession, Transaction, TransactionType } from "@/types";

export type CashActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";
const MENSAJE_CAJA_YA_ABIERTA = "Ya tenés una caja abierta.";
const MENSAJE_NO_ENCONTRADA = "Caja no encontrada o ya cerrada.";
const MENSAJE_SALDO_INVALIDO =
  "El saldo inicial debe ser un número mayor o igual a cero.";

const MENSAJE_CAJA_CERRADA =
  "Tenés que abrir tu caja antes de registrar movimientos.";
const MENSAJE_PRODUCTO_INVALIDO = "Producto no encontrado o inactivo.";
const MENSAJE_STOCK_CAMBIO =
  "El stock cambió mientras vendías. Intentá de nuevo.";
const MENSAJE_VENTA_SIN_CAJA =
  "Se descontó el stock, pero la venta no se pudo reflejar en la caja. Avisá para revisar el desfase.";

// Códigos SQLSTATE de Postgres: violación de restricción única (el índice
// parcial one_open_session_per_user de la migración) y de un `check` (ej.
// products.stock >= 0).
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

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
 * Vende un producto: descuenta stock e inserta el ingreso en la caja
 * abierta. El monto sale de `products.price` leído acá (nunca del payload),
 * mismo criterio que completeWalkinAction.
 *
 * El descuento de stock es un update condicionado al stock recién leído
 * (`.eq("stock", ...)`): si otro barbero vendió en el medio, no matchea
 * ninguna fila y se pide reintentar, en vez de pisar su venta. El
 * `check (stock >= 0)` de la tabla es la última barrera.
 *
 * *(Deuda técnica transaccional, spec 07 sección 5.2)*: sin RPC atómico,
 * son dos queries separadas. Si el insert de la transacción falla después
 * de descontar el stock, se devuelve un error explícito para revisar el
 * desfase a mano. Ver docs/deuda-tecnica.md.
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

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, price, stock, is_active")
    .eq("id", payload.productId)
    .maybeSingle<{
      id: string;
      name: string;
      price: number;
      stock: number;
      is_active: boolean;
    }>();

  if (productError) {
    console.error("sellProductAction (products):", productError.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!product || !product.is_active) {
    return { success: false, error: MENSAJE_PRODUCTO_INVALIDO };
  }

  if (payload.quantity > product.stock) {
    return {
      success: false,
      error:
        product.stock === 0
          ? `No queda stock de ${product.name}.`
          : `No hay stock suficiente de ${product.name} (quedan ${product.stock}).`,
    };
  }

  const { data: updated, error: stockError } = await supabase
    .from("products")
    .update({ stock: product.stock - payload.quantity })
    .eq("id", product.id)
    .eq("stock", product.stock)
    .select("id")
    .maybeSingle();

  if (stockError) {
    if (stockError.code === CHECK_VIOLATION) {
      return { success: false, error: MENSAJE_STOCK_CAMBIO };
    }
    console.error("sellProductAction (stock):", stockError.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!updated) {
    return { success: false, error: MENSAJE_STOCK_CAMBIO };
  }

  const { data: created, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      cash_session_id: session.id,
      type: "income",
      amount: product.price * payload.quantity,
      description:
        payload.quantity > 1
          ? `Venta: ${product.name} x${payload.quantity}`
          : `Venta: ${product.name}`,
    })
    .select()
    .single();

  if (transactionError) {
    console.error(
      "sellProductAction (transactions):",
      transactionError.message,
    );
    return { success: false, error: MENSAJE_VENTA_SIN_CAJA };
  }

  revalidatePath("/caja");
  revalidatePath("/productos");
  return { success: true, data: created as Transaction };
}
