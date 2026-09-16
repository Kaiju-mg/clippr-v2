"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Appointment, AppointmentStatus } from "@/types";

export type AgendaActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface SchedulePayload {
  clientName: string;
  serviceId: string;
  startTimeISO: string;
}

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";
const MENSAJE_CAJA_INVALIDA =
  "Debes abrir tu caja diaria antes de cobrar un corte.";
const MENSAJE_SERVICIO_INVALIDO = "Servicio no encontrado o inactivo.";
const MENSAJE_FECHA_INVALIDA = "La fecha no es válida.";
const MENSAJE_CLIENTE_INVALIDO = "El nombre del cliente es obligatorio.";
const MENSAJE_INICIO_INVALIDO = "El horario de inicio del turno no es válido.";
const MENSAJE_TURNO_INVALIDO = "Turno no encontrado o ya fue actualizado.";
const MENSAJE_TRANSACCION_FALLIDA =
  "El corte se guardó, pero no se pudo reflejar en la caja. Avisá para revisar el desfase.";

// Estados que la agenda lista (spec 06, sección 3). "walkin" existe en el
// check constraint de la migración de la spec 05 pero ningún flujo lo usa
// hoy: completeWalkinAction guarda directo en "completed".
const ESTADOS_AGENDA: AppointmentStatus[] = [
  "scheduled",
  "completed",
  "cancelled",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Límites [start, end) del día pedido, en UTC. El servidor (y el default
 * de "hoy" en `page.tsx`) también calculan la fecha en UTC, así que ambos
 * lados usan el mismo criterio — igual que el resto del código, que no
 * hace manejo explícito de zona horaria (ver docs/deuda-tecnica.md).
 */
function getDayRange(dateISO: string): { start: string; end: string } | null {
  if (!DATE_RE.test(dateISO)) return null;

  const start = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Turnos del barbero actual para el día pedido, ordenados por hora de
 * inicio. RLS (`appointments_select_own`) ya acota a los propios y al
 * tenant — acá solo se filtra por fecha y por los estados que le
 * interesan a la agenda.
 */
export async function getAgendaAction(
  dateISO: string,
): Promise<AgendaActionResult<Appointment[]>> {
  const range = getDayRange(dateISO);
  if (!range) {
    return { success: false, error: MENSAJE_FECHA_INVALIDA };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
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

  if (Number.isNaN(new Date(payload.startTimeISO).getTime())) {
    return MENSAJE_INICIO_INVALIDO;
  }

  return null;
}

/**
 * Agenda un turno futuro (o del pasado del mismo día — sección 6 de la
 * spec permite anotarlo tarde: no hay validación de que `startTimeISO`
 * sea posterior a ahora, a propósito). `end_time` se deriva de la
 * duración del servicio, nunca de un dato mandado por el cliente.
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

  const startTime = new Date(payload.startTimeISO);
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
    console.error(
      "scheduleAppointmentAction (appointments):",
      error.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  revalidatePath("/agenda");
  return { success: true, data: created as Appointment };
}

/**
 * Completa y cobra un turno agendado: mismos principios que
 * completeWalkinAction (spec 05) — el precio se lee de `services.price`
 * en el servidor (nunca del cliente), la caja se valida antes de cobrar y
 * `end_time` se pisa con el reloj del servidor. El `eq("status",
 * "scheduled")` del update es la barrera contra completarlo dos veces
 * (doble tap con red lenta), mismo criterio que closeCashSessionAction.
 *
 * *(Misma deuda transaccional que completeWalkinAction, spec 05)*: sin
 * RPC atómico, el insert de `transactions` es un paso separado del
 * update de `appointments`.
 */
export async function completeScheduledAppointmentAction(
  appointmentId: string,
  cashSessionId: string,
): Promise<AgendaActionResult<Appointment>> {
  const supabase = await createClient();

  const { data: cashSession, error: cashSessionError } = await supabase
    .from("cash_sessions")
    .select("id, status")
    .eq("id", cashSessionId)
    .maybeSingle<{ id: string; status: string }>();

  if (cashSessionError) {
    console.error(
      "completeScheduledAppointmentAction (cash_sessions):",
      cashSessionError.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!cashSession || cashSession.status !== "open") {
    return { success: false, error: MENSAJE_CAJA_INVALIDA };
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, service_id, status")
    .eq("id", appointmentId)
    .maybeSingle<{ id: string; service_id: string; status: string }>();

  if (appointmentError) {
    console.error(
      "completeScheduledAppointmentAction (appointments select):",
      appointmentError.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!appointment || appointment.status !== "scheduled") {
    return { success: false, error: MENSAJE_TURNO_INVALIDO };
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, price")
    .eq("id", appointment.service_id)
    .maybeSingle<{ id: string; name: string; price: number }>();

  if (serviceError || !service) {
    console.error(
      "completeScheduledAppointmentAction (services):",
      serviceError?.message ?? "servicio no encontrado",
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const { data: updated, error: updateError } = await supabase
    .from("appointments")
    .update({ status: "completed", end_time: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("status", "scheduled")
    .select()
    .maybeSingle();

  if (updateError) {
    console.error(
      "completeScheduledAppointmentAction (appointments update):",
      updateError.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!updated) {
    return { success: false, error: MENSAJE_TURNO_INVALIDO };
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
      "completeScheduledAppointmentAction (transactions):",
      transactionError.message,
    );
    return { success: false, error: MENSAJE_TRANSACCION_FALLIDA };
  }

  revalidatePath("/agenda");
  revalidatePath("/caja");
  return { success: true, data: updated as Appointment };
}

/**
 * Cancela un turno agendado (no asistió). El `eq("status", "scheduled")`
 * del update cubre en un solo paso "no existe", "es de otro barbero" (RLS)
 * y "ya se había completado/cancelado": los tres casos devuelven el mismo
 * mensaje, mismo criterio que closeCashSessionAction con cajas ya
 * cerradas.
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
  return { success: true, data: updated as Appointment };
}
