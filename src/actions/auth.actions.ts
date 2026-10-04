"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LEGAL } from "@/lib/legal";

export type ActionResult =
  { success: true } | { success: false; error: string };

export interface RegisterOwnerInput {
  email: string;
  password: string;
  ownerName: string;
  barbershopName: string;
  /** La casilla "Acepto los Términos y la Política de Privacidad". */
  acceptedTerms: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";

/**
 * Registra al dueño y su barbería. El alta es atómica vía la función RPC
 * `register_owner` (ver supabase/migrations): si falla, no queda un
 * usuario de Auth "fantasma" sin perfil asociado.
 */
export async function registerOwnerAction(
  data: RegisterOwnerInput,
): Promise<ActionResult> {
  // También en el servidor: la casilla del formulario se puede saltear
  // llamando a la acción directo.
  if (data.acceptedTerms !== true) {
    return {
      success: false,
      error:
        "Para crear la cuenta tenés que aceptar los Términos y la Política de Privacidad.",
    };
  }

  if (data.password.length < 6) {
    return {
      success: false,
      error: "La contraseña debe tener al menos 6 caracteres.",
    };
  }

  const supabase = await createClient();

  // Qué versión de los textos aceptó y cuándo, en los metadatos del usuario
  // de Auth: queda la constancia sin una migración (2026-10-04).
  const { error: signUpError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        terms_version: LEGAL.version,
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });

  if (signUpError) {
    if (/already registered|already exists/i.test(signUpError.message)) {
      return { success: false, error: "Este correo ya está registrado." };
    }
    console.error("registerOwnerAction: signUp falló:", signUpError.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  const { error: rpcError } = await supabase.rpc("register_owner", {
    p_barbershop_name: data.barbershopName,
    p_owner_name: data.ownerName,
  });

  if (rpcError) {
    console.error(
      "registerOwnerAction: register_owner falló:",
      rpcError.message,
    );
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return { success: true };
}

export async function loginAction(data: LoginInput): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    return { success: false, error: "Email o contraseña incorrectos." };
  }

  return { success: true };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * Cambia la contraseña del usuario autenticado (pensado para que un barbero
 * reemplace la temporal que le dio el dueño, pero sirve para cualquiera).
 * Pide la contraseña actual y la verifica antes de cambiarla: sin eso,
 * alguien con el celular del barbero desbloqueado y la sesión abierta
 * podría cambiarla y dejarlo afuera.
 */
export async function changePasswordAction(
  data: ChangePasswordInput,
): Promise<ActionResult> {
  if (data.newPassword.length < 6) {
    return {
      success: false,
      error: "La contraseña nueva debe tener al menos 6 caracteres.",
    };
  }

  if (data.newPassword === data.currentPassword) {
    return {
      success: false,
      error: "La contraseña nueva tiene que ser distinta de la actual.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  // Supabase no pide la contraseña actual en updateUser: la verificamos
  // con un login del mismo usuario (la sesión sigue siendo la suya).
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: data.currentPassword,
  });

  if (verifyError) {
    return { success: false, error: "La contraseña actual no es correcta." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: data.newPassword,
  });

  if (updateError) {
    if (updateError.code === "weak_password") {
      return {
        success: false,
        error: "Esa contraseña es muy débil. Probá con una más larga.",
      };
    }
    console.error("changePasswordAction:", updateError.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return { success: true };
}
