-- El guaraní (PYG) no tiene subunidad — sin centavos. Ajustamos el tipo de
-- la columna para que coincida con la validación del Server Action
-- (docs/decisiones.md, 2026-09-14).

alter table public.services
  alter column price type integer using round(price)::integer;
