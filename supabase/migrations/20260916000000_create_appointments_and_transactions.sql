-- Flujo de Walk-ins y Temporizador (docs/specs/05-flujo-walkins-temporizador.md)
-- Aplicar con `supabase db push` (o pegar en el SQL Editor del dashboard)
-- contra el proyecto ya linkeado (ver docs/decisiones.md).

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  -- default a current_user_id()/current_barbershop_id(): mismo patrón que
  -- cash_sessions, el insert nunca recibe estos campos desde el cliente.
  user_id uuid not null default public.current_user_id()
    references public.users (id) on delete cascade,
  barbershop_id uuid not null default public.current_barbershop_id()
    references public.barbershops (id) on delete cascade,
  service_id uuid not null references public.services (id),
  client_name text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null check (status in ('scheduled', 'walkin', 'completed', 'cancelled'))
);

create index if not exists appointments_barbershop_id_idx
  on public.appointments (barbershop_id);

alter table public.appointments enable row level security;

-- Igual de estricto que cash_sessions hoy (cash_sessions_select_own /
-- cash_sessions_insert_own, ver migración 20260915010000): cada barbero
-- ve e inserta solo sus propios turnos, ni el dueño ve los ajenos todavía.
-- La spec 05 sugería que el dueño viera todo el tenant, pero eso es el
-- mismo patrón que cash_sessions ya revirtió por privacidad entre
-- compañeros (ver docs/decisiones.md 2026-09-15) — queda para cuando se
-- implemente la spec 08 de estadísticas, con una policy nueva y más
-- específica. Ver docs/decisiones.md.
create policy appointments_select_own on public.appointments
  for select
  using (
    barbershop_id = public.current_barbershop_id()
    and user_id = public.current_user_id()
  );

create policy appointments_insert_own on public.appointments
  for insert
  with check (
    barbershop_id = public.current_barbershop_id()
    and user_id = public.current_user_id()
  );

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references public.cash_sessions (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount integer not null check (amount > 0),
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists transactions_cash_session_id_idx
  on public.transactions (cash_session_id);

alter table public.transactions enable row level security;

-- transactions no tiene user_id/barbershop_id propios (no están en el
-- modelo de docs/arquitectura.md): el aislamiento se resuelve verificando,
-- vía un EXISTS, que la cash_session referenciada sea la propia. El
-- EXISTS corre con los privilegios de quien consulta, así que ya queda
-- acotado por la policy cash_sessions_select_own de la caja referenciada
-- — mismo criterio estricto que appointments y cash_sessions.
create policy transactions_select_own on public.transactions
  for select
  using (
    exists (
      select 1 from public.cash_sessions cs
      where cs.id = transactions.cash_session_id
        and cs.user_id = public.current_user_id()
        and cs.barbershop_id = public.current_barbershop_id()
    )
  );

create policy transactions_insert_own on public.transactions
  for insert
  with check (
    exists (
      select 1 from public.cash_sessions cs
      where cs.id = transactions.cash_session_id
        and cs.user_id = public.current_user_id()
        and cs.barbershop_id = public.current_barbershop_id()
    )
  );
