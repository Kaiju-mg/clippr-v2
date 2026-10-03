-- Separación de ingresos en estadísticas (docs/specs/09-estabilizacion-y-pulido.md, paso 3)
-- Aplicar con `supabase db push` (o pegar en el SQL Editor del dashboard)
-- contra el proyecto ya linkeado (ver docs/decisiones.md).
--
-- Hasta acá, un ingreso de `transactions` sólo se distinguía por el texto de
-- `description` ("Corte: ..." vs "Venta: ..."), así que el ticket promedio
-- del dueño dividía TODO lo cobrado (cortes + productos + propinas) por la
-- cantidad de cortes e inflaba el número (ver docs/deuda-tecnica.md).
-- `category` lo vuelve un dato de primera clase.

alter table public.transactions
  add column if not exists category text not null default 'service';

alter table public.transactions
  drop constraint if exists transactions_category_check;

alter table public.transactions
  add constraint transactions_category_check
  check (category in ('service', 'product', 'manual'));

-- El `default 'service'` deja bien las filas de cortes, que son la mayoría,
-- pero marcaría como corte a las ventas y a los movimientos manuales que ya
-- existen. Se corrigen por el prefijo de la descripción, que es exactamente
-- el criterio que hasta ahora usábamos a ojo: "Venta: X" lo escribe
-- sellProductAction y "Corte: X" los dos cobros de turnos; cualquier otra
-- cosa la tipeó una persona en el formulario de movimientos.
update public.transactions
set category = case
  when description like 'Venta: %' then 'product'
  when description like 'Corte: %' then 'service'
  else 'manual'
end;

create index if not exists transactions_category_idx
  on public.transactions (category);

-- Los tres RPC de la migración 20260920000000 pasan a escribir la categoría.
-- Se reemplazan enteros (`create or replace`) porque plpgsql no permite
-- parchear el cuerpo: el resto del código es idéntico al de esa migración,
-- que sigue siendo la referencia para entender qué valida cada uno.

create or replace function public.complete_walkin_and_charge(
  p_service_id uuid,
  p_cash_session_id uuid,
  p_start_time timestamptz,
  p_client_name text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_barbershop_id uuid := public.current_barbershop_id();
  v_session_id uuid := public.assert_open_cash_session(p_cash_session_id);
  v_service public.services;
  v_appointment public.appointments;
begin
  if p_start_time is null or p_start_time > now() then
    raise exception 'Horario de inicio inválido' using errcode = 'CL003';
  end if;

  select * into v_service
  from public.services s
  where s.id = p_service_id
    and s.barbershop_id = v_barbershop_id
    and s.is_active;

  if v_service.id is null then
    raise exception 'Servicio no encontrado o inactivo' using errcode = 'CL002';
  end if;

  insert into public.appointments (
    user_id, barbershop_id, service_id, client_name,
    start_time, end_time, status
  )
  values (
    v_user_id, v_barbershop_id, v_service.id, nullif(btrim(p_client_name), ''),
    p_start_time, now(), 'completed'
  )
  returning * into v_appointment;

  insert into public.transactions (cash_session_id, type, amount, description, category)
  values (v_session_id, 'income', v_service.price, 'Corte: ' || v_service.name, 'service');

  return v_appointment;
end;
$$;

create or replace function public.complete_appointment_and_charge(
  p_appointment_id uuid,
  p_cash_session_id uuid,
  p_max_start_time timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_barbershop_id uuid := public.current_barbershop_id();
  v_session_id uuid := public.assert_open_cash_session(p_cash_session_id);
  v_appointment public.appointments;
  v_service public.services;
  v_start_time timestamptz;
begin
  select * into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
    and a.user_id = v_user_id
    and a.barbershop_id = v_barbershop_id
    and a.status = 'scheduled'
  for update;

  if v_appointment.id is null then
    raise exception 'Turno no encontrado o ya actualizado' using errcode = 'CL004';
  end if;

  if p_max_start_time is not null and v_appointment.start_time >= p_max_start_time then
    raise exception 'Turno de un día futuro' using errcode = 'CL007';
  end if;

  select * into v_service
  from public.services s
  where s.id = v_appointment.service_id;

  if v_service.id is null then
    raise exception 'Servicio no encontrado' using errcode = 'CL002';
  end if;

  v_start_time := v_appointment.start_time;
  if now() < v_start_time then
    v_start_time := now() - (v_service.duration_minutes * interval '1 minute');
  end if;

  update public.appointments
  set status = 'completed',
      end_time = now(),
      start_time = v_start_time
  where id = v_appointment.id
  returning * into v_appointment;

  insert into public.transactions (cash_session_id, type, amount, description, category)
  values (v_session_id, 'income', v_service.price, 'Corte: ' || v_service.name, 'service');

  return v_appointment;
end;
$$;

create or replace function public.sell_product_and_charge(
  p_product_id uuid,
  p_cash_session_id uuid,
  p_quantity integer
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbershop_id uuid := public.current_barbershop_id();
  v_session_id uuid := public.assert_open_cash_session(p_cash_session_id);
  v_product public.products;
  v_transaction public.transactions;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Cantidad inválida' using errcode = 'CL009';
  end if;

  select * into v_product
  from public.products p
  where p.id = p_product_id
    and p.barbershop_id = v_barbershop_id
    and p.is_active
  for update;

  if v_product.id is null then
    raise exception 'Producto no encontrado o inactivo' using errcode = 'CL005';
  end if;

  if v_product.stock < p_quantity then
    raise exception '%', v_product.name using errcode = 'CL006',
      detail = v_product.stock::text;
  end if;

  update public.products
  set stock = stock - p_quantity
  where id = v_product.id;

  insert into public.transactions (cash_session_id, type, amount, description, category)
  values (
    v_session_id,
    'income',
    v_product.price * p_quantity,
    case
      when p_quantity > 1
        then 'Venta: ' || v_product.name || ' x' || p_quantity
      else 'Venta: ' || v_product.name
    end,
    'product'
  )
  returning * into v_transaction;

  return v_transaction;
end;
$$;
