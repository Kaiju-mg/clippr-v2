-- Productos y Movimientos de Caja (docs/specs/07-productos-y-movimientos-caja.md)
-- Aplicar con `supabase db push` (o pegar en el SQL Editor del dashboard)
-- contra el proyecto ya linkeado (ver docs/decisiones.md).

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  -- default a current_barbershop_id(): mismo patrón que services, el insert
  -- nunca recibe barbershop_id desde el cliente.
  barbershop_id uuid not null default public.current_barbershop_id()
    references public.barbershops (id) on delete cascade,
  name text not null,
  -- guaraníes, sin decimales (ver services_price_integer).
  price integer not null check (price > 0),
  -- check >= 0: última barrera si dos ventas del último producto se cruzan
  -- (sellProductAction además hace un update condicionado al stock leído).
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer check (low_stock_threshold >= 0),
  -- borrado lógico, igual que services. Ver docs/decisiones.md.
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_barbershop_id_idx on public.products (barbershop_id);

alter table public.products enable row level security;

-- Todo el equipo ve el catálogo y puede actualizar stock (una venta la hace
-- cualquier barbero). Que solo el dueño edite precios/nombres o active y
-- desactive productos se valida en product.actions.ts, no acá (spec 07,
-- sección 3). Sin policy de delete: el borrado es lógico.
create policy products_select_same_barbershop on public.products
  for select
  using (barbershop_id = public.current_barbershop_id());

create policy products_insert_same_barbershop on public.products
  for insert
  with check (barbershop_id = public.current_barbershop_id());

create policy products_update_same_barbershop on public.products
  for update
  using (barbershop_id = public.current_barbershop_id());
