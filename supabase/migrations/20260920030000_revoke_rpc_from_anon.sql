-- Corrección de las dos migraciones anteriores (spec 09), encontrada al
-- verificarlas contra el proyecto real el 2026-09-20.
--
-- Las migraciones 20260920000000 y 20260920010000 hacían
-- `revoke execute ... from public` antes de otorgarle a `authenticated`,
-- dando por hecho que eso dejaba afuera al usuario anónimo. No es así:
-- Supabase tiene un `alter default privileges ... grant execute on functions
-- to anon, authenticated, service_role`, así que cada función nace con un
-- grant **explícito** a `anon` que un revoke sobre PUBLIC no toca. Se
-- verificó en la base: `proacl` mostraba `anon=X/postgres`, y un POST a
-- /rest/v1/rpc/... con la anon key entraba al cuerpo de la función.
--
-- No había fuga de datos —las cinco cortan con CL008 apenas ven que
-- `current_user_id()` es null, y son SECURITY DEFINER justamente por eso—
-- pero la barrera tiene que estar antes de entrar, no adentro.

revoke execute on function public.assert_open_cash_session(uuid) from anon;
revoke execute on function public.complete_walkin_and_charge(uuid, uuid, timestamptz, text) from anon;
revoke execute on function public.complete_appointment_and_charge(uuid, uuid, timestamptz) from anon;
revoke execute on function public.sell_product_and_charge(uuid, uuid, integer) from anon;
revoke execute on function public.update_team_member(uuid, text, numeric) from anon;
