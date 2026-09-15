-- Corrige cash_sessions_select_same_barbershop (migración anterior): el
-- SELECT quedaba abierto a toda la barbería, así que cualquier barbero
-- autenticado podía leer el saldo de la caja de un compañero (ej. desde la
-- consola del navegador, sin pasar por la UI). Ver docs/decisiones.md
-- 2026-09-15 ("SELECT también acotado a user_id...").

drop policy if exists cash_sessions_select_same_barbershop on public.cash_sessions;

create policy cash_sessions_select_own on public.cash_sessions
  for select
  using (
    barbershop_id = public.current_barbershop_id()
    and user_id = public.current_user_id()
  );
