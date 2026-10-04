"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import type { User } from "@/types";

export type BarbershopActionResult<T> =
  { success: true; data: T } | { success: false; error: string };

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";
const MENSAJE_ACCESO_DENEGADO =
  "Acceso denegado: solo el dueño puede editar la barbería.";
const MENSAJE_TELEFONO_INVALIDO =
  "El teléfono no es válido: usá sólo números, espacios, +, - o paréntesis.";

type CurrentProfile = Pick<User, "barbershop_id" | "role">;

async function getCurrentProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CurrentProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("barbershop_id, role")
    .eq("auth_id", user.id)
    .maybeSingle<CurrentProfile>();

  return data ?? null;
}

/**
 * Guarda el teléfono de la barbería (spec 10, fase 3), que aparece como
 * "Turnos: …" en la imagen de compartir el día. Sólo el dueño: se valida acá
 * para dar un mensaje claro, pero la barrera es la base (policy
 * `barbershops_update_owner` + `grant update (name, phone)`).
 *
 * No recibe el id de la barbería: es la del perfil propio, nunca la que
 * mande el cliente.
 */
export async function updateBarbershopPhoneAction(
  rawPhone: string,
): Promise<BarbershopActionResult<{ phone: string | null }>> {
  const phone = normalizePhone(rawPhone);
  if (phone === undefined) {
    return { success: false, error: MENSAJE_TELEFONO_INVALIDO };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile || profile.role !== "owner") {
    return { success: false, error: MENSAJE_ACCESO_DENEGADO };
  }

  const { data, error } = await supabase
    .from("barbershops")
    .update({ phone })
    .eq("id", profile.barbershop_id)
    .select("phone")
    .maybeSingle<{ phone: string | null }>();

  if (error) {
    console.error("updateBarbershopPhoneAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  // Sin fila: la policy la filtró (no es el dueño, aunque el perfil diga
  // que sí). No se muestra como éxito.
  if (!data) {
    return { success: false, error: MENSAJE_ACCESO_DENEGADO };
  }

  revalidatePath("/mas");
  return { success: true, data: { phone: data.phone } };
}
