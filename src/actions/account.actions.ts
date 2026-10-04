"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BARBER_DELETE_CONFIRMATION,
  NOMBRE_CUENTA_ELIMINADA,
} from "@/lib/legal";
import type { UserRole } from "@/types";

export type AccountActionResult =
  { success: true } | { success: false; error: string };

const MENSAJE_ERROR_GENERICO =
  "No pudimos eliminar la cuenta. Intentá de nuevo o escribinos.";
const MENSAJE_CONFIRMACION =
  "Para confirmar, escribí exactamente lo que se pide.";
const MENSAJE_CAJA_ABIERTA =
  "Tenés una caja abierta. Cerrala antes de eliminar tu cuenta.";
const MENSAJE_SIN_CLAVE =
  "La eliminación de cuentas no está disponible en este momento. Escribinos.";

interface Perfil {
  id: string;
  role: UserRole;
  barbershop_id: string;
  barbershops: { name: string } | null;
}

/** Normaliza lo que escribió la persona para comparar sin sorpresas. */
function normalizar(texto: string): string {
  return texto.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

/**
 * Elimina la cuenta del usuario autenticado (2026-10-04). Siempre la propia:
 * no recibe ids, la cuenta sale de la sesión.
 *
 * - **Barbero:** su historia de caja es del negocio, así que no se borra: la
 *   fila de `users` se anonimiza ("Barbero eliminado") y se borra su usuario
 *   de Auth (email y contraseña). La migración
 *   `20261004010000_users_auth_set_null_on_delete.sql` hace que eso deje la
 *   fila sin login en vez de borrarla en cascada. No puede tener una caja
 *   abierta: quedaría abierta para siempre.
 * - **Dueño:** se borra la barbería entera (equipo, servicios, productos,
 *   cajas, turnos y cobros, por las cascadas de `barbershop_id`) y después las
 *   cuentas de Auth de todo el equipo. Para confirmar escribe el nombre de la
 *   barbería.
 *
 * Usa la clave de servicio (`createAdminClient`) sólo para lo que la sesión
 * no puede: borrar usuarios de Auth y la fila de la barbería (no hay policy
 * de `delete` para nadie). Al terminar cierra la sesión y manda a `/login`.
 */
export async function deleteAccountAction(
  confirmation: string,
): Promise<AccountActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: MENSAJE_ERROR_GENERICO };

  const { data: perfil } = await supabase
    .from("users")
    .select("id, role, barbershop_id, barbershops(name)")
    .eq("auth_id", user.id)
    .maybeSingle<Perfil>();

  if (!perfil) return { success: false, error: MENSAJE_ERROR_GENERICO };

  const esBarbero = perfil.role === "barber";
  const esperado = esBarbero
    ? BARBER_DELETE_CONFIRMATION
    : (perfil.barbershops?.name ?? "");

  if (!esperado || normalizar(confirmation) !== normalizar(esperado)) {
    return { success: false, error: MENSAJE_CONFIRMACION };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: MENSAJE_SIN_CLAVE };
  }

  const admin = createAdminClient();

  if (esBarbero) {
    const { data: abierta, error: cajaError } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("user_id", perfil.id)
      .eq("status", "open")
      .maybeSingle();

    if (cajaError) {
      console.error("deleteAccountAction (caja):", cajaError.message);
      return { success: false, error: MENSAJE_ERROR_GENERICO };
    }
    if (abierta) return { success: false, error: MENSAJE_CAJA_ABIERTA };

    // Primero se anonimiza y recién después se borra el login: si fallara al
    // revés, quedaría el nombre de una persona que ya pidió irse.
    const { error: anonError } = await admin
      .from("users")
      .update({ name: NOMBRE_CUENTA_ELIMINADA, commission_pct: 0 })
      .eq("id", perfil.id);

    if (anonError) {
      console.error("deleteAccountAction (anonimizar):", anonError.message);
      return { success: false, error: MENSAJE_ERROR_GENERICO };
    }

    const { error: authError } = await admin.auth.admin.deleteUser(user.id);
    if (authError) {
      console.error("deleteAccountAction (auth):", authError.message);
      return { success: false, error: MENSAJE_ERROR_GENERICO };
    }
  } else {
    // El equipo se lee antes de borrar la barbería: después ya no está.
    const { data: equipo, error: equipoError } = await admin
      .from("users")
      .select("auth_id")
      .eq("barbershop_id", perfil.barbershop_id);

    if (equipoError) {
      console.error("deleteAccountAction (equipo):", equipoError.message);
      return { success: false, error: MENSAJE_ERROR_GENERICO };
    }

    // Primero los datos: si después falla borrar algún login, lo que queda
    // es una cuenta vacía, nunca la información del negocio.
    const { error: barberiaError } = await admin
      .from("barbershops")
      .delete()
      .eq("id", perfil.barbershop_id);

    if (barberiaError) {
      console.error("deleteAccountAction (barbería):", barberiaError.message);
      return { success: false, error: MENSAJE_ERROR_GENERICO };
    }

    const authIds = ((equipo ?? []) as { auth_id: string | null }[])
      .map((miembro) => miembro.auth_id)
      .filter((id): id is string => Boolean(id));

    const fallidos: string[] = [];
    for (const authId of authIds) {
      const { error } = await admin.auth.admin.deleteUser(authId);
      if (error) fallidos.push(authId);
    }

    if (fallidos.length > 0) {
      console.error(
        "deleteAccountAction: no se pudieron borrar logins:",
        fallidos.join(", "),
      );
      return { success: false, error: MENSAJE_ERROR_GENERICO };
    }
  }

  // El usuario de Auth ya no existe: sólo hace falta limpiar las cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?cuenta=eliminada");
}
