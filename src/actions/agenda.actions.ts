"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  businessDateTimeToUtc,
  businessDayRangeUtc,
  businessToday,
  isValidDateISO,
  isValidTime,
} from "@/lib/dates";
import {
  CAJA_INVALIDA,
  SERVICIO_INVALIDO,
  SIN_SESION,
  TURNO_FUTURO,
  TURNO_INVALIDO,
} from "@/lib/db-errors";
import type { Appointment, AppointmentStatus } from "@/types";

export type AgendaActionResult<T> =
  { success: true; data: T } | { success: false; error: string };

export interface SchedulePayload {
  clientName: string;
  serviceId: string;
  /** Día calendario (YYYY-MM-DD) en la zona horaria de la barbería. */
  dateISO: string;
  /** Hora de pared (HH:MM) en la zona horaria de la barbería. */
  time: string;
}

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";
const MENSAJE_CAJA_INVALIDA =
  "Debes abrir tu caja diaria antes de cobrar un corte.";
const MENSAJE_SERVICIO_INVALIDO = "Servicio no encontrado o inactivo.";
const MENSAJE_FECHA_INVALIDA = "La fecha no es válida.";
const MENSAJE_CLIENTE_INVALIDO = "El nombre del cliente es obligatorio.";
const MENSAJE_INICIO_INVALIDO = "El horario de inicio del turno no es válido.";
const MENSAJE_TURNO_INVALIDO = "Turno no encontrado o ya fue actualizado.";
const MENSAJE_TURNO_FUTURO = "No podés cobrar un turno de un día futuro.";

// Estados que la agenda lista (spec 06, sección 3). "walkin" existe en el
// check constraint de la migración de la spec 05 pero ningún flujo lo usa
// hoy: completeWalkinAction guarda directo en "completed".
const ESTADOS_AGENDA: AppointmentStatus[] = [
  "scheduled",
  "completed",
  "cancelled",
];

/**
 * id (public.users) del usuario autenticado. Desde la spec 08, RLS deja al
 * dueño leer los turnos de todo su equipo (para las estadísticas), así que
 * la agenda tiene que filtrar el suyo a mano: `/agenda` es la agenda
 * personal, no la de la barbería. No es un filtro de tenant (eso lo sigue
 * haciendo RLS, regla 2 de CLAUDE.md), es un filtro de pantalla.
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

/**
 * Turnos del barbero actual para el día pedido (día de Paraguay, no de UTC),
 * ordenados por hora de inicio.
 */
export async function getAgendaAction(
  dateISO: string,
): Promise<AgendaActionResult<Appointment[]>> {
  if (!isValidDateISO(dateISO)) {
    return { success: false, error: MENSAJE_FECHA_INVALIDA };
  }

  const range = businessDayRangeUtc(dateISO);
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", userId)
    .in("status", ESTADOS_AGENDA)
    .gte("start_time", range.start)
    .lt("start_time", range.end)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("getAgendaAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return { success: true, data: (data ?? []) as Appointment[] };
}

function validateSchedulePayload(payload: SchedulePayload): string | null {
  if (!payload.clientName || payload.clientName.trim().length === 0) {
    return MENSAJE_CLIENTE_INVALIDO;
  }

  if (!isValidDateISO(payload.dateISO) || !isValidTime(payload.time)) {
    return MENSAJE_INICIO_INVALIDO;
  }

  return null;
}

/**
 * Agenda un turno. El instante se arma acá con la zona horaria de la
 * barbería (`@/lib/dates`), no en el celular: así un turno de las 21:30 cae
 * en el día correcto aunque el dispositivo tenga otra zona configurada. No
 * valida que sea futuro: la spec permite anotar tarde un turno de hoy.
 */
export async function scheduleAppointmentAction(
  payload: SchedulePayload,
): Promise<AgendaActionResult<Appointment>> {
  const validationError = validateSchedulePayload(payload);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, duration_minutes, is_active")
    .eq("id", payload.serviceId)
    .maybeSingle<{
      id: string;
      duration_minutes: number;
      is_active: boolean;
    }>();

  if (serviceError) {
    console.error(
      "scheduleAppointmentAction (services):",
      serviceError.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!service || !service.is_active) {
    return { success: false, error: MENSAJE_SERVICIO_INVALIDO };
  }

  const startTime = businessDateTimeToUtc(payload.dateISO, payload.time);
  const endTime = new Date(
    startTime.getTime() + service.duration_minutes * 60_000,
  );

  const { data: created, error } = await supabase
    .from("appointments")
    .insert({
      service_id: service.id,
      client_name: payload.clientName.trim(),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: "scheduled",
    })
    .select()
    .single();

  if (error) {
    console.error("scheduleAppointmentAction (appointments):", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  // /inicio también lista los turnos del día desde el 2026-09-20: sin esta
  // revalidación, agendar en /agenda dejaba a /inicio mostrando la lista
  // vieja hasta que algo más la invalidara.
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  return { success: true, data: created as Appointment };
}

/**
 * Completa y cobra un turno agendado en una sola llamada al RPC
 * `complete_appointment_and_charge` (migración 20260920000000): el update de
 * `appointments` y el insert de `transactions` pasaron a correr dentro de la
 * misma transacción de Postgres, así que ya no puede quedar un turno cobrado
 * sin su ingreso en la caja (spec 09, paso 1).
 *
 * Mismos principios que antes: el precio lo lee la base de `services.price`
 * (nunca viaja en el payload), la caja se valida como propia y abierta, y
 * `end_time` sale del reloj del servidor. El `for update` del RPC reemplaza
 * al viejo `eq("status", "scheduled")` como barrera contra el doble cobro:
 * un segundo toque con red lenta espera al primero y ya no encuentra el
 * turno en `scheduled`.
 *
 * Si se cobra antes de la hora agendada, el RPC corre `start_time` a
 * `ahora - duración` para que el turno nunca quede con `end_time` anterior a
 * `start_time` (rompería las duraciones de la spec 08).
 *
 * `p_max_start_time` es el fin del día de hoy del negocio: la zona horaria se
 * resuelve acá con `@/lib/dates` y se manda como instante, para que
 * `America/Asuncion` siga viviendo en un solo lugar y no también en el SQL.
 * Un turno que arranca en o después de ese instante es de un día futuro y no
 * se puede cobrar. Ver docs/decisiones.md 2026-09-16.
 */
export async function completeScheduledAppointmentAction(
  appointmentId: string,
  cashSessionId: string,
): Promise<AgendaActionResult<Appointment>> {
  const supabase = await createClient();
  const finDeHoy = businessDayRangeUtc(businessToday()).end;

  const { data, error } = await supabase
    .rpc("complete_appointment_and_charge", {
      p_appointment_id: appointmentId,
      p_cash_session_id: cashSessionId,
      p_max_start_time: finDeHoy,
    })
    .single();

  if (error) {
    switch (error.code) {
      case CAJA_INVALIDA:
      case SIN_SESION:
        return { success: false, error: MENSAJE_CAJA_INVALIDA };
      case TURNO_INVALIDO:
        return { success: false, error: MENSAJE_TURNO_INVALIDO };
      case TURNO_FUTURO:
        return { success: false, error: MENSAJE_TURNO_FUTURO };
      case SERVICIO_INVALIDO:
        return { success: false, error: MENSAJE_SERVICIO_INVALIDO };
      default:
        console.error("completeScheduledAppointmentAction:", error.message);
        return { success: false, error: MENSAJE_ERROR_GENERICO };
    }
  }

  revalidatePath("/agenda");
  revalidatePath("/inicio");
  revalidatePath("/caja");
  return { success: true, data: data as Appointment };
}

/**
 * Cancela un turno agendado (no asistió). El `eq("status", "scheduled")`
 * del update cubre en un solo paso "no existe", "es de otro barbero" (RLS)
 * y "ya se había completado/cancelado": los tres devuelven el mismo mensaje.
 */
export async function cancelAppointmentAction(
  appointmentId: string,
): Promise<AgendaActionResult<Appointment>> {
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .eq("status", "scheduled")
    .select()
    .maybeSingle();

  if (error) {
    console.error("cancelAppointmentAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!updated) {
    return { success: false, error: MENSAJE_TURNO_INVALIDO };
  }

  revalidatePath("/agenda");
  revalidatePath("/inicio");
  return { success: true, data: updated as Appointment };
}
