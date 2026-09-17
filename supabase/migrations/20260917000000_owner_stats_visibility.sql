-- Estadísticas, Niveles y Rachas (docs/specs/08-estadisticas-niveles-rachas.md)
-- Aplicar con `supabase db push` (o pegar en el SQL Editor del dashboard)
-- contra el proyecto ya linkeado (ver docs/decisiones.md).
--
-- Hasta acá, las policies de SELECT de cash_sessions, appointments y
-- transactions eran estrictas: solo el dueño de la fila podía leerla, ni
-- siquiera el dueño de la barbería (decisión del 2026-09-15, que ya dejaba
-- anotado que esto se revisaría en la spec 08). El dashboard del dueño
-- necesita leer los datos de todo su equipo, así que el SELECT se abre —
-- solo para el rol `owner`, y solo dentro de su propia barbería.

-- Rol del usuario autenticado. Mismo patrón que current_barbershop_id() /
-- current_user_id(): SECURITY DEFINER para leer public.users sin pasar por
-- sus propias policies y evitar recursión infinita al usarla adentro de las
-- policies de abajo.
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users where auth_id = auth.uid() limit 1;
$$;

-- El chequeo de tenant (barbershop_id = current_barbershop_id()) queda como
-- primer factor en todas las policies, igual que antes: es la barrera de
-- multi-tenant (regla 2 de CLAUDE.md) y no depende del rol. Lo que cambia es
-- el segundo factor: además del dueño de la fila, ahora pasa el `owner`.
drop policy if exists cash_sessions_select_own on public.cash_sessions;

create policy cash_sessions_select_own on public.cash_sessions
  for select
  using (
    barbershop_id = public.current_barbershop_id()
    and (
      user_id = public.current_user_id()
      or public.current_user_role() = 'owner'
    )
  );

drop policy if exists appointments_select_own on public.appointments;

create policy appointments_select_own on public.appointments
  for select
  using (
    barbershop_id = public.current_barbershop_id()
    and (
      user_id = public.current_user_id()
      or public.current_user_role() = 'owner'
    )
  );

-- transactions no tiene columnas de tenant propias: el aislamiento se
-- resuelve con el EXISTS contra la cash_session referenciada (ver migración
-- 20260916000000). El criterio nuevo se aplica adentro de ese EXISTS.
-- INSERT no se toca: sigue exigiendo caja propia y abierta (migración
-- 20260916030000). El dueño puede leer la caja de un barbero, no cargarle
-- movimientos.
drop policy if exists transactions_select_own on public.transactions;

create policy transactions_select_own on public.transactions
  for select
  using (
    exists (
      select 1 from public.cash_sessions cs
      where cs.id = transactions.cash_session_id
        and cs.barbershop_id = public.current_barbershop_id()
        and (
          cs.user_id = public.current_user_id()
          or public.current_user_role() = 'owner'
        )
    )
  );

-- Índices para las consultas por rango de fecha de las estadísticas: sin
-- esto, el dashboard del dueño hace un seq scan sobre todos los turnos y
-- cajas de la barbería cada vez que se cambia de filtro.
create index if not exists appointments_user_start_time_idx
  on public.appointments (user_id, start_time);

create index if not exists cash_sessions_user_start_time_idx
  on public.cash_sessions (user_id, start_time);
