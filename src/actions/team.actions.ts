"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTemporaryPassword } from "@/lib/passwords";
import type { User, UserLevel } from "@/types";

export type TeamActionResult<T> =
  { success: true; data: T } | { success: false; error: string };

export interface BarberPayload {
  name: string;
  email: string;
  level: UserLevel;
  commission_pct: number;
}

export interface UpdateBarberPayload {
  level?: UserLevel;
  commission_pct?: number;
}

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";
const MENSAJE_NO_ENCONTRADO = "Barbero no encontrado.";
const MENSAJE_ACCESO_DENEGADO =
  "Acceso denegado: solo el dueño puede gestionar el equipo.";
const MENSAJE_CORREO_DUPLICADO = "Este correo ya está registrado en Clippr.";

export interface CreatedBarber {
  barber: User;
  /**
   * Contraseña temporal aleatoria. Solo viaja en esta respuesta para que el
   * dueño la vea una vez: no se guarda ni se loguea en ningún lado. El
   * barbero la puede cambiar en /mas/cambiar-password. Ver docs/decisiones.md.
   */
  temporaryPassword: string;
}

const NIVELES_VALIDOS: UserLevel[] = ["junior", "pro", "senior", "elite"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida los campos presentes en el payload. `Partial` porque
 * updateBarberAction solo manda los campos que cambian.
 */
function validateBarberPayload(data: Partial<BarberPayload>): string | null {
  if (data.name !== undefined && data.name.trim().length === 0) {
    return "El nombre es obligatorio.";
  }

  if (data.email !== undefined && !EMAIL_REGEX.test(data.email.trim())) {
    return "El correo no es válido.";
  }

  if (data.level !== undefined && !NIVELES_VALIDOS.includes(data.level)) {
    return "Nivel inválido.";
  }

  if (
    data.commission_pct !== undefined &&
    (typeof data.commission_pct !== "number" ||
      Number.isNaN(data.commission_pct) ||
      data.commission_pct < 0 ||
      data.commission_pct > 100)
  ) {
    return "La comisión debe ser un porcentaje entre 0 y 100.";
  }

  return null;
}

type CurrentProfile = Pick<User, "id" | "barbershop_id" | "role">;

/**
 * Perfil (public.users) del usuario autenticado que ejecuta la acción.
 * Se usa tanto para el control de acceso por rol como para heredar el
 * barbershop_id del dueño al crear un barbero — nunca se toma ese valor
 * del payload que manda el cliente.
 */
async function getCurrentProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CurrentProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, barbershop_id, role")
    .eq("auth_id", user.id)
    .maybeSingle<CurrentProfile>();

  return data ?? null;
}

/**
 * Devuelve todo el equipo (dueño + barberos) de la barbería del usuario
 * autenticado. No filtra por barbershop_id a mano: RLS
 * (`users_select_same_barbershop`) es la barrera de tenant.
 */
export async function getTeamAction(): Promise<TeamActionResult<User[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("name");

  if (error) {
    console.error("getTeamAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return { success: true, data: (data ?? []) as User[] };
}

/**
 * Da de alta a un barbero: crea su cuenta de Auth (Admin API, sin afectar
 * la sesión del dueño) y su perfil en public.users. Solo un dueño puede
 * ejecutar esto — se valida acá, no solo con RLS (ver docs/specs/03).
 * Cada barbero arranca con su propia contraseña temporal aleatoria, que se
 * devuelve una sola vez para mostrársela al dueño.
 */
export async function createBarberAction(
  data: BarberPayload,
): Promise<TeamActionResult<CreatedBarber>> {
  const validationError = validateBarberPayload(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile || profile.role !== "owner") {
    return { success: false, error: MENSAJE_ACCESO_DENEGADO };
  }

  const admin = createAdminClient();
  const email = data.email.trim();
  const temporaryPassword = generateTemporaryPassword();

  const { data: authResult, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });

  if (authError) {
    if (/already been registered|already exists/i.test(authError.message)) {
      return { success: false, error: MENSAJE_CORREO_DUPLICADO };
    }
    console.error("createBarberAction: createUser falló:", authError.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  // Perfil insertado con el cliente normal (sesión del dueño, no el admin):
  // así la política RLS de INSERT también corre, no solo la validación de
  // arriba. barbershop_id sale del perfil que ya leímos, nunca del payload.
  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({
      auth_id: authResult.user.id,
      barbershop_id: profile.barbershop_id,
      role: "barber",
      name: data.name.trim(),
      level: data.level,
      commission_pct: data.commission_pct,
    })
    .select()
    .single();

  if (insertError) {
    console.error(
      "createBarberAction: insert de perfil falló:",
      insertError.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  revalidatePath("/equipo");
  return {
    success: true,
    data: { barber: created as User, temporaryPassword },
  };
}

/**
 * Modifica nivel y/o comisión de un barbero. Solo un dueño puede
 * ejecutarlo (ver docs/specs/03-gestion-de-equipo.md, sección 5: un
 * barbero no debería poder subirse la comisión interceptando la petición).
 */
export async function updateBarberAction(
  id: string,
  data: UpdateBarberPayload,
): Promise<TeamActionResult<User>> {
  const validationError = validateBarberPayload(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile || profile.role !== "owner") {
    return { success: false, error: MENSAJE_ACCESO_DENEGADO };
  }

  const updatePayload: UpdateBarberPayload = {};
  if (data.level !== undefined) updatePayload.level = data.level;
  if (data.commission_pct !== undefined) {
    updatePayload.commission_pct = data.commission_pct;
  }

  const { data: updated, error } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("updateBarberAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!updated) {
    return { success: false, error: MENSAJE_NO_ENCONTRADO };
  }

  revalidatePath("/equipo");
  return { success: true, data: updated as User };
}
