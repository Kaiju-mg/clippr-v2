-- Catálogo de Servicios (docs/specs/02-catalogo-de-servicios.md)
-- Aplicar con `supabase db push` (o pegar en el SQL Editor del dashboard)
-- contra el proyecto ya linkeado (ver docs/decisiones.md).

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  -- default a current_barbershop_id(): el insert nunca recibe barbershop_id
  -- desde el cliente, así no hay forma de "spoofearlo" desde el frontend.
  barbershop_id uuid not null default public.current_barbershop_id()
    references public.barbershops (id) on delete cascade,
  name text not null,
  price numeric not null check (price > 0),
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  -- borrado lógico: los turnos (spec futura) van a referenciar service_id y
  -- un DELETE físico rompería ese historial. Ver docs/decisiones.md.
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists services_barbershop_id_idx on public.services (barbershop_id);

alter table public.services enable row level security;

create policy services_select_same_barbershop on public.services
  for select
  using (barbershop_id = public.current_barbershop_id());

create policy services_insert_same_barbershop on public.services
  for insert
  with check (barbershop_id = public.current_barbershop_id());

create policy services_update_same_barbershop on public.services
  for update
  using (barbershop_id = public.current_barbershop_id());

create policy services_delete_same_barbershop on public.services
  for delete
  using (barbershop_id = public.current_barbershop_id());
