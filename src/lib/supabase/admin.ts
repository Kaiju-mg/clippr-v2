import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la Service Role Key: bypassea RLS por completo.
 * Uso exclusivo en el servidor y solo para lo que la Admin API resuelve
 * (ej. `auth.admin.createUser` al dar de alta un barbero, para no cerrar la
 * sesión del dueño como pasaría con `auth.signUp`). Nunca importar desde
 * código que corra en el browser ni usarlo para leer/escribir datos de
 * negocio (eso sigue pasando por `lib/supabase/server.ts`, con RLS).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
