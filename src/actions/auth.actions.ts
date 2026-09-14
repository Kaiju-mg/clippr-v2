"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionResult =
  { success: true } | { success: false; error: string };

export interface RegisterOwnerInput {
  email: string;
  password: string;
  ownerName: string;
  barbershopName: string;
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
  if (data.password.length < 6) {
    return {
      success: false,
      error: "La contraseña debe tener al menos 6 caracteres.",
    };
  }

  const supabase = await createClient();

  const { error: signUpError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
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
