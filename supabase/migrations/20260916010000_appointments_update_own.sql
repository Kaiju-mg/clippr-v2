-- Agenda de Turnos Programados (docs/specs/06-agenda-de-turnos-programados.md)
-- Permite a un barbero actualizar sus propios turnos (ej. completarlos o cancelarlos).

create policy appointments_update_own on public.appointments
  for update
  using (
    barbershop_id = public.current_barbershop_id()
    and user_id = public.current_user_id()
  );
