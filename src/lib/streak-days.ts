/**
 * Consultas de "qué días trabajó el barbero" para la racha. Sólo servidor:
 * reciben el cliente de Supabase de la sesión (acotado por RLS) y las usan
 * `cash.actions.ts` (recalcular la racha al cerrar) y `stats.actions.ts`
 * (saber si la racha está viva, en peligro o apagada para el poste).
 *
 * Vive fuera de `src/actions/` porque un archivo `"use server"` sólo puede
 * exportar funciones async públicas, y esto no es una acción.
 */
import { businessDateOf } from "@/lib/dates";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Cuántas cajas cerradas hacia atrás se miran para encontrar la última
 * jornada válida. Con un día de gracia de 2 días alcanza de sobra: sirve
 * para descartar varias cajas del mismo día sin traer el historial entero.
 */
export const CAJAS_CERRADAS_A_REVISAR = 10;

/**
 * Días del negocio (sin repetir) de las cajas que tuvieron al menos un
 * ingreso. Una sola consulta para todas las cajas, en vez de una por caja.
 * Devuelve null si la consulta falla.
 */
export async function businessDatesWithIncome(
  supabase: SupabaseServerClient,
  sessions: { id: string; start_time: string }[],
): Promise<string[] | null> {
  if (sessions.length === 0) return [];

  const { data, error } = await supabase
    .from("transactions")
    .select("cash_session_id")
    .eq("type", "income")
    .in(
      "cash_session_id",
      sessions.map((session) => session.id),
    );

  if (error) {
    console.error("businessDatesWithIncome:", error.message);
    return null;
  }

  const withIncome = new Set(
    ((data ?? []) as { cash_session_id: string }[]).map(
      (row) => row.cash_session_id,
    ),
  );

  return [
    ...new Set(
      sessions
        .filter((session) => withIncome.has(session.id))
        .map((session) => businessDateOf(new Date(session.start_time))),
    ),
  ];
}

/**
 * Día del negocio de la última caja cerrada con al menos un ingreso del
 * barbero, o null si no tiene ninguna. `undefined` si una consulta falló:
 * quien llama decide qué mostrar sin dato (el poste no tiene que mentir).
 *
 * Filtra `user_id` a mano: desde la spec 08 el dueño ve las cajas de su
 * barbería, así que RLS ya no acota `cash_sessions` a las propias.
 */
export async function lastWorkedDate(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<string | null | undefined> {
  // El estado de la racha es un dato secundario de /inicio y /estadisticas:
  // cualquier cosa rara (una fecha inválida, la red) tiene que terminar en
  // "sin dato", nunca en una excepción que tumbe la pantalla.
  try {
    return await queryLastWorkedDate(supabase, userId);
  } catch (error) {
    console.error("lastWorkedDate:", error);
    return undefined;
  }
}

async function queryLastWorkedDate(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<string | null | undefined> {
  const { data, error } = await supabase
    .from("cash_sessions")
    .select("id, start_time")
    .eq("user_id", userId)
    .eq("status", "closed")
    .order("start_time", { ascending: false })
    .limit(CAJAS_CERRADAS_A_REVISAR);

  if (error) {
    console.error("lastWorkedDate:", error.message);
    return undefined;
  }

  const dates = await businessDatesWithIncome(
    supabase,
    (data ?? []) as { id: string; start_time: string }[],
  );
  if (dates === null) return undefined;

  return dates.length > 0
    ? dates.reduce((latest, date) => (date > latest ? date : latest))
    : null;
}
