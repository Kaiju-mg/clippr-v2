-- Teléfono de la barbería y `update` sólo para el dueño
-- (docs/specs/10-theme-recibo.md, fase 3).
-- Aplicar con `supabase db push` contra el proyecto ya linkeado.
--
-- 1. `phone`: el renglón "Turnos: {teléfono}" de la imagen para compartir el
--    día. Opcional: si es null, la imagen no lo dibuja. El formato lo valida
--    también el Server Action; el `check` es la red de abajo.
--
-- 2. `barbershops_update_own` (spec 01) dejaba a **cualquier integrante**
--    actualizar la fila de su barbería, incluido `subscription_plan`: un
--    barbero podía pasarse a "team" desde la consola del navegador con su
--    propia sesión. Mismo arreglo que `users` en
--    `20260920010000_users_update_hardening.sql`, en dos capas:
--
--    - La policy acota la FILA y el ROL: sólo el dueño, y sólo la suya.
--    - Los grants por columna acotan el CAMPO: una policy no puede mirar qué
--      columna cambió, así que `subscription_plan` queda afuera del
--      `grant update`. Ni el dueño puede cambiarse el plan: eso llega con
--      la facturación (Fase 2 del producto), por `service_role`.
--
-- No crea funciones, así que no hace falta el `revoke ... from anon` de
-- `20260920030000_revoke_rpc_from_anon.sql`.

alter table public.barbershops
  add column if not exists phone text null;

alter table public.barbershops
  drop constraint if exists barbershops_phone_format;

alter table public.barbershops
  add constraint barbershops_phone_format
  check (phone is null or phone ~ '^[0-9 +()-]{6,25}$');

drop policy if exists barbershops_update_own on public.barbershops;
drop policy if exists barbershops_update_owner on public.barbershops;

-- El `with check` impide además cambiarle el id a la fila en el mismo update.
create policy barbershops_update_owner on public.barbershops
  for update
  using (
    id = public.current_barbershop_id()
    and public.current_user_role() = 'owner'
  )
  with check (id = public.current_barbershop_id());

-- El grant de tabla completa viene de Supabase (`grant all on all tables in
-- schema public to anon, authenticated`). Se revoca y se devuelve sólo lo
-- que el dueño puede editar. `service_role` queda intacto.
revoke update on public.barbershops from anon;
revoke update on public.barbershops from authenticated;
grant update (name, phone) on public.barbershops to authenticated;
