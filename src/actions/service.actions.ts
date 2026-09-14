"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Service } from "@/types";

export type ServiceActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ServicePayload {
  name: string;
  price: number;
  duration_minutes: number;
}

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";
const MENSAJE_NO_ENCONTRADO = "Servicio no encontrado.";

/**
 * Valida los campos presentes en el payload. `Partial` porque
 * updateServiceAction permite mandar solo los campos que cambian.
 */
function validateServicePayload(data: Partial<ServicePayload>): string | null {
  if (data.name !== undefined && data.name.trim().length === 0) {
    return "El nombre del servicio es obligatorio.";
  }

  if (
    data.price !== undefined &&
    (typeof data.price !== "number" ||
      !Number.isInteger(data.price) ||
      data.price <= 0)
  ) {
    // El guaraní no tiene subunidad (sin centavos), así que el precio
    // se guarda y valida como entero. Ver docs/decisiones.md.
    return "El precio debe ser un número entero mayor a cero.";
  }

  if (
    data.duration_minutes !== undefined &&
    (typeof data.duration_minutes !== "number" ||
      !Number.isInteger(data.duration_minutes) ||
      data.duration_minutes <= 0)
  ) {
    return "La duración debe ser un número entero de minutos mayor a cero.";
  }

  return null;
}

/**
 * Devuelve todos los servicios de la barbería (activos e inactivos: la UI
 * necesita ver los inactivos para poder reactivarlos con el switch). RLS
 * filtra por tenant automáticamente (política
 * `services_select_same_barbershop`); no hace falta (ni corresponde)
 * filtrar por barbershop_id acá a mano.
 */
export async function getServicesAction(): Promise<
  ServiceActionResult<Service[]>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name");

  if (error) {
    console.error("getServicesAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return { success: true, data: (data ?? []) as Service[] };
}

/**
 * Crea un servicio. No manda barbershop_id: la columna lo completa sola
 * vía `default current_barbershop_id()` en la migración, así el cliente
 * no puede "elegir" para qué tenant crea el registro.
 */
export async function createServiceAction(
  data: ServicePayload,
): Promise<ServiceActionResult<Service>> {
  const validationError = validateServicePayload(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();

  const { data: created, error } = await supabase
    .from("services")
    .insert({
      name: data.name.trim(),
      price: data.price,
      duration_minutes: data.duration_minutes,
    })
    .select()
    .single();

  if (error) {
    console.error("createServiceAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  revalidatePath("/servicios");
  return { success: true, data: created as Service };
}

/**
 * Actualiza un servicio existente. No filtra por barbershop_id a mano: si
 * el id pertenece a otro tenant, la política de UPDATE de RLS hace que la
 * fila no matchee y no se actualice nada (se lo tratamos como "no
 * encontrado", no como error de servidor).
 */
export async function updateServiceAction(
  id: string,
  data: Partial<ServicePayload>,
): Promise<ServiceActionResult<Service>> {
  const validationError = validateServicePayload(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const updatePayload: Partial<ServicePayload> = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.price !== undefined) updatePayload.price = data.price;
  if (data.duration_minutes !== undefined) {
    updatePayload.duration_minutes = data.duration_minutes;
  }

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("services")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("updateServiceAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!updated) {
    return { success: false, error: MENSAJE_NO_ENCONTRADO };
  }

  revalidatePath("/servicios");
  return { success: true, data: updated as Service };
}

/**
 * Prende/apaga un servicio (is_active). No es un DELETE físico: los
 * turnos de specs futuras van a referenciar service_id y un DELETE
 * rompería ese historial. A diferencia del borrado lógico original de
 * esta spec, acá es reversible desde la UI (switch), no una acción de
 * una sola dirección. Ver docs/decisiones.md.
 */
export async function toggleServiceStatusAction(
  id: string,
  isActive: boolean,
): Promise<ServiceActionResult<Service>> {
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("services")
    .update({ is_active: isActive })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("toggleServiceStatusAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!updated) {
    return { success: false, error: MENSAJE_NO_ENCONTRADO };
  }

  revalidatePath("/servicios");
  return { success: true, data: updated as Service };
}
