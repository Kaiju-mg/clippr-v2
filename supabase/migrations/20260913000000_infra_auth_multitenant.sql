-- Infraestructura base, auth y multi-tenant (docs/specs/01-infra-auth-multitenant.md)
-- No aplicada automáticamente: no hay proyecto Supabase linkeado en este repo.
-- Aplicar con `supabase db push` (o pegar en el SQL Editor del dashboard)
-- una vez que exista un proyecto real.

create table if not exists public.barbershops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subscription_plan text not null default 'trial'
    check (subscription_plan in ('trial', 'pro', 'team')),
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users (id) on delete cascade,
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  role text not null check (role in ('owner', 'barber', 'independent')),
  name text not null,
  level text not null default 'junior'
    check (level in ('junior', 'pro', 'senior', 'elite')),
  commission_pct numeric not null default 0,
  streak_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists users_barbershop_id_idx on public.users (barbershop_id);

-- Devuelve el barbershop_id del usuario autenticado. SECURITY DEFINER para
-- poder leer public.users sin pasar por sus propias políticas de RLS y
-- evitar recursión al usarla dentro de esas políticas.
create or replace function public.current_barbershop_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select barbershop_id from public.users where auth_id = auth.uid() limit 1;
$$;

alter table public.barbershops enable row level security;
alter table public.users enable row level security;

create policy barbershops_select_own on public.barbershops
  for select
  using (id = public.current_barbershop_id());

create policy barbershops_update_own on public.barbershops
  for update
  using (id = public.current_barbershop_id());

create policy users_select_same_barbershop on public.users
  for select
  using (barbershop_id = public.current_barbershop_id());

create policy users_insert_same_barbershop on public.users
  for insert
  with check (barbershop_id = public.current_barbershop_id());

create policy users_update_same_barbershop on public.users
  for update
  using (barbershop_id = public.current_barbershop_id());

-- Alta atómica de dueño + barbería. SECURITY DEFINER: al momento del
-- registro todavía no existe una fila en public.users para auth.uid(),
-- así que las policies de arriba (que dependen de current_barbershop_id())
-- bloquearían el insert. La función valida explícitamente en vez de
-- depender de RLS.
create or replace function public.register_owner(
  p_barbershop_name text,
  p_owner_name text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
  v_barbershop_id uuid;
  v_user public.users;
begin
  if v_auth_id is null then
    raise exception 'No hay sesión autenticada';
  end if;

  if exists (select 1 from public.users where auth_id = v_auth_id) then
    raise exception 'El usuario ya tiene un perfil asociado';
  end if;

  insert into public.barbershops (name)
  values (p_barbershop_name)
  returning id into v_barbershop_id;

  insert into public.users (auth_id, barbershop_id, role, name)
  values (v_auth_id, v_barbershop_id, 'owner', p_owner_name)
  returning * into v_user;

  return v_user;
end;
$$;

grant execute on function public.register_owner(text, text) to authenticated;
