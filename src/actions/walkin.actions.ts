"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Appointment } from "@/types";

export type WalkinActionResult<T> =
  { success: true; data: T } | { success: false; error: string };

export interface CompleteWalkinPayload {
  serviceId: string;
  cashSessionId: string;
  /**
   * ISO, viene del `startTime` local del timer (Zustand) — a diferencia de
   * `end_time` (ver más abajo), este valor sí tiene que venir del cliente:
   * es el momento en que el barbero arrancó el timer en su dispositivo, un
   * dato que el servidor no puede conocer de otra forma (rule #4/#3 de
   * CLAUDE.md: los timers son locales y toleran caídas de internet).
   */
  startTime: string;
  clientName?: string;
}

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";
const MENSAJE_CAJA_INVALIDA =
  "Debes abrir tu caja diaria antes de cobrar un corte.";
const MENSAJE_SERVICIO_INVALIDO = "Servicio no encontrado o inactivo.";
const MENSAJE_INICIO_INVALIDO = "El horario de inicio del turno no es válido.";
const MENSAJE_TRANSACCION_FALLIDA =
  "El corte se guardó, pero no se pudo reflejar en la caja. Avisá para revisar el desfase.";

function validateStartTime(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
    return MENSAJE_INICIO_INVALIDO;
  }
  return null;
}

/**
 * Completa un walk-in: verifica la caja y el servicio, crea el `appointment`
 * y la `transaction` de ingreso correspondiente. El monto nunca viene del
 * cliente — se lee `services.price` acá, del lado del servidor, por
 * `serviceId` — y `end_time` se calcula con el reloj del servidor, mismo
 * criterio que `closeCashSessionAction` en `cash.actions.ts`: no hay que
 * confiar en un timestamp mandado por un Client Component (el celular del
 * barbero puede tener mal la hora), y menos en un monto (ver el postmortem
 * de "cualquier usuario puede alterar las peticiones HTTP y manipular la
 * caja" en docs/aprendizajes-v1.md).
 *
 * *(Deuda técnica transaccional, spec 05 sección 4)*: sin RPC atómico, son
 * dos inserts separados. Si el segundo (transactions) falla después de que
 * el primero (appointments) ya se guardó, se prioriza no perder el
 * registro del turno y se devuelve un error explícito para que el barbero
 * sepa que hay que revisar el desfase a mano.
 */
export async function completeWalkinAction(
  payload: CompleteWalkinPayload,
): Promise<WalkinActionResult<Appointment>> {
  const startTimeError = validateStartTime(payload.startTime);
  if (startTimeError) {
    return { success: false, error: startTimeError };
  }

  const supabase = await createClient();

  const { data: cashSession, error: cashSessionError } = await supabase
    .from("cash_sessions")
    .select("id, status")
    .eq("id", payload.cashSessionId)
    .maybeSingle<{ id: string; status: string }>();

  if (cashSessionError) {
    console.error(
      "completeWalkinAction (cash_sessions):",
      cashSessionError.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  // Si el id no es una caja propia y abierta, RLS (cash_sessions_select_own)
  // ya la devuelve como null — se trata igual que "no tenés caja abierta",
  // mismo criterio que closeCashSessionAction.
  if (!cashSession || cashSession.status !== "open") {
    return { success: false, error: MENSAJE_CAJA_INVALIDA };
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, price, is_active")
    .eq("id", payload.serviceId)
    .maybeSingle<{
      id: string;
      name: string;
      price: number;
      is_active: boolean;
    }>();

  if (serviceError) {
    console.error("completeWalkinAction (services):", serviceError.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!service || !service.is_active) {
    return { success: false, error: MENSAJE_SERVICIO_INVALIDO };
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      service_id: service.id,
      client_name: payload.clientName?.trim() || null,
      start_time: payload.startTime,
      end_time: new Date().toISOString(),
      status: "completed",
    })
    .select()
    .single();

  if (appointmentError) {
    console.error(
      "completeWalkinAction (appointments):",
      appointmentError.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const { error: transactionError } = await supabase
    .from("transactions")
    .insert({
      cash_session_id: cashSession.id,
      type: "income",
      amount: service.price,
      description: `Corte: ${service.name}`,
    });

  if (transactionError) {
    console.error(
      "completeWalkinAction (transactions):",
      transactionError.message,
    );
    return { success: false, error: MENSAJE_TRANSACCION_FALLIDA };
  }

  revalidatePath("/inicio");
  revalidatePath("/caja");
  return { success: true, data: appointment as Appointment };
}
