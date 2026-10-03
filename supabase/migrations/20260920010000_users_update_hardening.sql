-- Seguridad en gamificación (docs/specs/09-estabilizacion-y-pulido.md, paso 2)
-- Aplicar con `supabase db push` (o pegar en el SQL Editor del dashboard)
-- contra el proyecto ya linkeado (ver docs/decisiones.md).
--
-- `users_update_same_barbershop` (spec 01) dejaba a cualquier integrante
-- actualizar cualquier fila de `users` de su barbería. Con la spec 08 eso
-- pasó de ser incómodo a ser un agujero: un barbero podía inflarse
-- `streak_count` o subirse el `level` desde la consola del navegador con su
-- propia sesión, y de paso cambiarle la comisión a un compañero. El cálculo
-- estaba bien puesto en el servidor (regla 1 de CLAUDE.md), pero la escritura
-- no estaba cerrada (ver docs/deuda-tecnica.md).
--
-- Tres capas, porque una policy sola no alcanza:
--
-- 1. La policy acota la FILA: cada uno sólo puede tocar la suya.
-- 2. Los grants por columna acotan el CAMPO: una policy de RLS no puede
--    mirar qué columna cambió (no tiene OLD/NEW), así que la única forma
--    declarativa de impedir "me edito mi propio streak_count" es no darle a
--    `authenticated` el privilegio de UPDATE sobre esa columna. Con
--    `grant update (name)`, Postgres rechaza cualquier otro campo antes
--    incluso de evaluar la policy.
-- 3. Lo que sí tiene que poder escribirse pasa por caminos con privilegio
--    propio: el dueño editando a su equipo, por el RPC SECURITY DEFINER de
--    abajo (valida el rol, así que un barbero que lo llame directo rebota);
--    y la racha/nivel, por el cliente `service_role` del servidor
--    (`createAdminClient`), cuya key nunca sale del backend.
--
-- No se toca el INSERT (`users_insert_same_barbershop`): el alta de barberos
-- la sigue haciendo el dueño con su sesión, y `register_owner` es SECURITY
-- DEFINER, así que ninguno depende de los grants de `authenticated`.

drop policy if exists users_update_same_barbershop on public.users;

-- Sólo la fila propia. El `with check` además impide "moverse" de barbería
-- o cambiarse el id en el mismo update.
create policy users_update_own on public.users
  for update
  using (id = public.current_user_id())
  with check (id = public.current_user_id());

-- El grant de tabla completa viene de Supabase (`grant all on all tables in
-- schema public to anon, authenticated`). Se revoca y se devuelve sólo lo
-- que un usuario común tiene derecho a editar de sí mismo. `service_role`
-- queda intacto a propósito: es el que usa applyStreakAndLevel.
revoke update on public.users from anon;
revoke update on public.users from authenticated;
grant update (name) on public.users to authenticated;

-- Edición de un integrante del equipo por parte del dueño (`/equipo`:
-- nivel y comisión). SECURITY DEFINER para saltear los grants de arriba,
-- validando explícitamente lo que antes quedaba en manos de la policy
-- abierta: que quien llama sea `owner` y que el objetivo sea de su misma
-- barbería. Un barbero que llame a esta función directamente desde la
-- consola rebota con CL010.
--
-- Los parámetros en null significan "no cambiar este campo", igual que el
-- `Partial` de `UpdateBarberPayload` en team.actions.ts.
create or replace function public.update_team_member(
  p_user_id uuid,
  p_level text default null,
  p_commission_pct numeric default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbershop_id uuid := public.current_barbershop_id();
  v_user public.users;
begin
  if v_barbershop_id is null then
    raise exception 'No hay sesión autenticada' using errcode = 'CL008';
  end if;

  if public.current_user_role() is distinct from 'owner' then
    raise exception 'Solo el dueño puede gestionar el equipo'
      using errcode = 'CL010';
  end if;

  update public.users u
  set level = coalesce(p_level, u.level),
      commission_pct = coalesce(p_commission_pct, u.commission_pct)
  where u.id = p_user_id
    and u.barbershop_id = v_barbershop_id
  returning * into v_user;

  if v_user.id is null then
    raise exception 'Barbero no encontrado' using errcode = 'CL011';
  end if;

  return v_user;
end;
$$;

revoke execute on function public.update_team_member(uuid, text, numeric) from public;
grant execute on function public.update_team_member(uuid, text, numeric) to authenticated;
