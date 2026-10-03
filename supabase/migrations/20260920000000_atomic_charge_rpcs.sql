-- Transaccionalidad atómica de los cobros (docs/specs/09-estabilizacion-y-pulido.md, paso 1)
-- Aplicar con `supabase db push` (o pegar en el SQL Editor del dashboard)
-- contra el proyecto ya linkeado (ver docs/decisiones.md).
--
-- Hasta acá, cobrar un corte o vender un producto eran dos o tres viajes
-- separados a la base (validar caja -> escribir appointment/stock -> insertar
-- transaction). Si el último fallaba, quedaba un corte sin cobrar o stock
-- descontado sin ingreso, y el Server Action solo podía devolver un mensaje
-- pidiendo revisar el desfase a mano (ver docs/deuda-tecnica.md). Estas tres
-- funciones hacen todo en una sola llamada: el cuerpo de una función plpgsql
-- corre dentro de una única transacción, así que cualquier `raise` revierte
-- lo que se haya escrito antes. No hacen falta `BEGIN`/`COMMIT` explícitos
-- (de hecho plpgsql no los permite acá): la atomicidad ya está garantizada.
--
-- Las tres son SECURITY DEFINER porque necesitan bloquear filas
-- (`for update`) y escribir en varias tablas en un solo paso. Eso saltea RLS,
-- así que cada una revalida a mano lo que las policies garantizaban:
-- que la caja sea propia y esté abierta, y que el servicio/producto sea del
-- mismo tenant. Es el mismo criterio que `register_owner` (spec 01).
--
-- El monto NUNCA llega por parámetro: cada función lee `services.price` /
-- `products.price` de la base dentro de la misma transacción (regla 1 de
-- CLAUDE.md y postmortem de la v1 sobre manipulación de la caja desde el
-- cliente). Leerlo acá adentro además cierra la ventana que quedaba entre
-- "leer el precio" y "cobrarlo".
--
-- Errores de negocio: se señalan con SQLSTATE propios de la clase 'CL'
-- (libre, no la usa Postgres) para que el Server Action los traduzca a los
-- mismos mensajes en español que antes, en vez de mostrar un error genérico.
--   CL001  caja inexistente, ajena o cerrada
--   CL002  servicio inexistente, de otro tenant o inactivo
--   CL003  horario de inicio inválido
--   CL004  turno inexistente, ajeno o ya actualizado
--   CL005  producto inexistente, de otro tenant o inactivo
--   CL006  stock insuficiente (message = nombre, detail = stock restante)
--   CL007  turno de un día futuro
--   CL008  sin sesión autenticada
--   CL009  cantidad inválida

-- Caja abierta del usuario autenticado, validando pertenencia y estado.
-- Devuelve el id o levanta CL001/CL008. La usan las tres funciones de abajo.
create or replace function public.assert_open_cash_session(
  p_cash_session_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_barbershop_id uuid := public.current_barbershop_id();
  v_id uuid;
begin
  if v_user_id is null or v_barbershop_id is null then
    raise exception 'No hay sesión autenticada' using errcode = 'CL008';
  end if;

  select cs.id into v_id
  from public.cash_sessions cs
  where cs.id = p_cash_session_id
    and cs.user_id = v_user_id
    and cs.barbershop_id = v_barbershop_id
    and cs.status = 'open';

  if v_id is null then
    raise exception 'Caja inexistente, ajena o cerrada' using errcode = 'CL001';
  end if;

  return v_id;
end;
$$;

-- Cobra un walk-in: crea el turno ya completado y su ingreso, en un solo
-- paso. A diferencia del turno de agenda, acá el appointment todavía no
-- existe (el barbero arrancó de un timer, no de una reserva), así que la
-- función recibe el service_id y lo inserta — no un appointment_id.
--
-- `p_start_time` sí viene del cliente: es el momento en que arrancó el timer
-- en el dispositivo del barbero, un dato que el servidor no puede conocer de
-- otra forma (reglas 3 y 4 de CLAUDE.md). Se valida que no sea futuro.
-- `end_time`, en cambio, es `now()` de la base: nunca el reloj del celular.
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

  insert into public.transactions (cash_session_id, type, amount, description)
  values (v_session_id, 'income', v_service.price, 'Corte: ' || v_service.name);

  return v_appointment;
end;
$$;

-- Cobra un turno agendado: lo pasa a `completed` e inserta el ingreso.
--
-- `p_max_start_time` es el instante en que termina el día de hoy del negocio,
-- calculado por el Server Action con `businessDayRangeUtc` (`src/lib/dates.ts`).
-- Se pasa como parámetro en vez de resolver la zona horaria acá para que
-- `America/Asuncion` siga viviendo en un solo lugar del código (CLAUDE.md):
-- un turno que arranca en o después de ese instante es de un día futuro y no
-- se puede cobrar (ver docs/decisiones.md 2026-09-16).
--
-- El `for update` sobre el turno es lo que hace que un doble toque con red
-- lenta no cobre dos veces: el segundo se queda esperando y, cuando entra, ya
-- no lo ve en 'scheduled'.
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

  -- Cobrar antes de hora corre el inicio para que la duración no quede
  -- negativa (rompería las estadísticas de la spec 08).
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

  insert into public.transactions (cash_session_id, type, amount, description)
  values (v_session_id, 'income', v_service.price, 'Corte: ' || v_service.name);

  return v_appointment;
end;
$$;

-- Vende un producto: descuenta stock e inserta el ingreso, atómicamente.
--
-- El `for update` reemplaza el update condicionado al stock leído que hacía
-- `sellProductAction`: dos ventas simultáneas del último producto ya no
-- compiten, la segunda espera a que la primera termine y recién ahí lee el
-- stock. Si no alcanza, el `raise` revierte todo (incluido el descuento).
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
    -- El nombre va en el mensaje y el stock restante en el detail: el texto
    -- que ve el barbero se arma en el Server Action, no acá (la copia de la
    -- interfaz no vive en la base).
    raise exception '%', v_product.name using errcode = 'CL006',
      detail = v_product.stock::text;
  end if;

  update public.products
  set stock = stock - p_quantity
  where id = v_product.id;

  insert into public.transactions (cash_session_id, type, amount, description)
  values (
    v_session_id,
    'income',
    v_product.price * p_quantity,
    case
      when p_quantity > 1
        then 'Venta: ' || v_product.name || ' x' || p_quantity
      else 'Venta: ' || v_product.name
    end
  )
  returning * into v_transaction;

  return v_transaction;
end;
$$;

-- SECURITY DEFINER + `execute` a PUBLIC por defecto sería un agujero: se
-- revoca y se otorga solo a `authenticated`. Un anónimo igual se chocaría
-- con el CL008 de assert_open_cash_session, pero la barrera va antes.
revoke execute on function public.assert_open_cash_session(uuid) from public;
revoke execute on function public.complete_walkin_and_charge(uuid, uuid, timestamptz, text) from public;
revoke execute on function public.complete_appointment_and_charge(uuid, uuid, timestamptz) from public;
revoke execute on function public.sell_product_and_charge(uuid, uuid, integer) from public;

grant execute on function public.assert_open_cash_session(uuid) to authenticated;
grant execute on function public.complete_walkin_and_charge(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.complete_appointment_and_charge(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.sell_product_and_charge(uuid, uuid, integer) to authenticated;
