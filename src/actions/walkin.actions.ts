"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CAJA_INVALIDA,
  INICIO_INVALIDO,
  SERVICIO_INVALIDO,
  SIN_SESION,
} from "@/lib/db-errors";
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

function validateStartTime(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
    return MENSAJE_INICIO_INVALIDO;
  }
  return null;
}

/**
 * Completa un walk-in: crea el `appointment` ya cobrado y su `transaction`
 * de ingreso en una sola llamada al RPC `complete_walkin_and_charge`
 * (migración 20260920000000). Antes eran dos inserts sueltos y si el
 * segundo fallaba quedaba un corte sin cobrar; ahora la función corre
 * dentro de una única transacción de Postgres, así que o se guardan los dos
 * o no se guarda ninguno (spec 09, paso 1).
 *
 * El monto nunca viene del cliente ni viaja como parámetro: lo lee el RPC de
 * `services.price`, del lado de la base, dentro de la misma transacción (ver
 * el postmortem de "cualquier usuario puede alterar las peticiones HTTP y
 * manipular la caja" en docs/aprendizajes-v1.md). `end_time` también sale del
 * reloj del servidor, no del celular del barbero.
 *
 * El RPC es SECURITY DEFINER y revalida a mano lo que RLS garantizaba (caja
 * propia y abierta, servicio del mismo tenant), y devuelve los errores de
 * negocio con SQLSTATE propios (`@/lib/db-errors`) para poder seguir
 * mostrando el mensaje exacto en vez de uno genérico.
 */
export async function completeWalkinAction(
  payload: CompleteWalkinPayload,
): Promise<WalkinActionResult<Appointment>> {
  // Validación temprana, antes de pagar el viaje a la base. El RPC la
  // repite (CL003): esta es por rapidez, la de allá es la barrera real.
  const startTimeError = validateStartTime(payload.startTime);
  if (startTimeError) {
    return { success: false, error: startTimeError };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("complete_walkin_and_charge", {
      p_service_id: payload.serviceId,
      p_cash_session_id: payload.cashSessionId,
      p_start_time: payload.startTime,
      p_client_name: payload.clientName?.trim() || null,
    })
    .single();

  if (error) {
    switch (error.code) {
      case CAJA_INVALIDA:
      case SIN_SESION:
        return { success: false, error: MENSAJE_CAJA_INVALIDA };
      case SERVICIO_INVALIDO:
        return { success: false, error: MENSAJE_SERVICIO_INVALIDO };
      case INICIO_INVALIDO:
        return { success: false, error: MENSAJE_INICIO_INVALIDO };
      default:
        console.error("completeWalkinAction:", error.message);
        return { success: false, error: MENSAJE_ERROR_GENERICO };
    }
  }

  revalidatePath("/inicio");
  revalidatePath("/caja");
  return { success: true, data: data as Appointment };
}
