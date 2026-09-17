-- Productos y Movimientos de Caja (docs/specs/07-productos-y-movimientos-caja.md)
-- La spec 07 (sección 5.3) da por hecho que RLS ya impide cargar una
-- transacción en una caja cerrada, pero transactions_insert_own (migración
-- 20260916000000) solo verificaba que la caja fuera propia. Se suma
-- `cs.status = 'open'` para que la base sea la barrera real, no solo el
-- Server Action. Ver docs/decisiones.md.

drop policy if exists transactions_insert_own on public.transactions;

create policy transactions_insert_own on public.transactions
  for insert
  with check (
    exists (
      select 1 from public.cash_sessions cs
      where cs.id = transactions.cash_session_id
        and cs.user_id = public.current_user_id()
        and cs.barbershop_id = public.current_barbershop_id()
        and cs.status = 'open'
    )
  );
