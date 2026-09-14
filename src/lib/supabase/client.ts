import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para componentes del browser ("use client").
 * Usa la anon key + RLS. Nunca importar en código server-only.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
