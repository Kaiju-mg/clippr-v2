-- Sesión de Caja Diaria (docs/specs/04-sesion-de-caja-diaria.md)
-- Aplicar con `supabase db push` (o pegar en el SQL Editor del dashboard)
-- contra el proyecto ya linkeado (ver docs/decisiones.md).

-- Devuelve el id (public.users) del usuario autenticado. Mismo patrón que
-- current_barbershop_id() (ver migración de Spec 01): SECURITY DEFINER para
-- leer public.users sin pasar por sus propias políticas y evitar recursión
-- al usarla dentro de policies. La necesitamos acá para poder default-ear
-- user_id en el INSERT (igual que barbershop_id) y para las policies de
-- "solo el dueño de la caja puede abrirla/cerrarla" de abajo.
create or replace function public.current_user_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.users where auth_id = auth.uid() limit 1;
$$;

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  -- default a current_user_id()/current_barbershop_id(): el insert nunca
  -- recibe estos campos desde el cliente, así no hay forma de abrir una
  -- caja a nombre de otro barbero ni de otro tenant.
  user_id uuid not null default public.current_user_id()
    references public.users (id) on delete cascade,
  barbershop_id uuid not null default public.current_barbershop_id()
    references public.barbershops (id) on delete cascade,
  initial_balance numeric not null check (initial_balance >= 0),
  final_balance numeric,
  -- timestamptz + default now() asignado por la base de datos: nunca hay
  -- que confiar en un timestamp mandado por el cliente (el celular del
  -- barbero puede tener la hora mal configurada).
  start_time timestamptz not null default now(),
  end_time timestamptz,
  status text not null default 'open' check (status in ('open', 'closed'))
);

create index if not exists cash_sessions_barbershop_id_idx
  on public.cash_sessions (barbershop_id);

-- Crítico: garantiza a nivel de base de datos que un usuario no puede tener
-- más de una caja abierta a la vez, incluso si el Server Action se dispara
-- varias veces por una doble carga en un celular con mal internet.
create unique index if not exists one_open_session_per_user
  on public.cash_sessions (user_id)
  where status = 'open';

alter table public.cash_sessions enable row level security;

-- Select alcanza a toda la barbería (no solo la propia caja): el dueño
-- necesita poder ver las cajas de sus barberos (specs futuras de reportes).
create policy cash_sessions_select_same_barbershop on public.cash_sessions
  for select
  using (barbershop_id = public.current_barbershop_id());

-- Insert/Update sí están acotados al dueño de la caja: un barbero (o el
-- dueño) solo puede abrir o cerrar su propia caja, nunca la de otro
-- integrante de la misma barbería.
create policy cash_sessions_insert_own on public.cash_sessions
  for insert
  with check (
    barbershop_id = public.current_barbershop_id()
    and user_id = public.current_user_id()
  );

create policy cash_sessions_update_own on public.cash_sessions
  for update
  using (
    barbershop_id = public.current_barbershop_id()
    and user_id = public.current_user_id()
  );
