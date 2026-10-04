-- Borrar una cuenta sin borrar la caja del negocio (2026-10-04).
-- Aplicar con `supabase db push` contra el proyecto ya linkeado.
--
-- `users.auth_id` se creó (spec 01) como `not null ... on delete cascade`:
-- borrar un usuario de Auth borraba su fila de `users` y, en cascada, sus
-- `cash_sessions`, `appointments` y `transactions`. Para el dueño eso está
-- bien (al eliminar su cuenta se borra la barbería entera), pero un barbero
-- que elimina su cuenta se llevaría puesta la historia de caja de la
-- barbería, que es del negocio y no del barbero.
--
-- Con `on delete set null`, borrar el usuario de Auth (email, contraseña)
-- deja la fila de `users` sin login: `deleteAccountAction` antes la
-- anonimiza ("Barbero eliminado"). Una fila con `auth_id` null es una cuenta
-- eliminada: no la alcanza ninguna sesión (`current_user_id()` compara contra
-- `auth.uid()`) y `/equipo` no la lista.
--
-- No crea funciones, así que no hace falta el `revoke ... from anon` de
-- `20260920030000_revoke_rpc_from_anon.sql`.

alter table public.users
  alter column auth_id drop not null;

alter table public.users
  drop constraint if exists users_auth_id_fkey;

alter table public.users
  add constraint users_auth_id_fkey
  foreign key (auth_id) references auth.users (id) on delete set null;
