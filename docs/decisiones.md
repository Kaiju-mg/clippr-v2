## 2026-09-09 — Turnos como rango, no como slot fijo
Elegido: guardar inicio y fin en el turno.
Descartado: slots de 30 min predefinidos.
Por qué: los cortes de barba varían entre 20 y 60 min y los slots
fijos desperdiciaban agenda.
Costo: las consultas de disponibilidad son más complejas.

## 2026-09-09 — Vitest como runner de tests, no Jest
Elegido: Vitest + Testing Library.
Descartado: Jest con `next/jest`.
Por qué: Vitest es ESM-nativo y arranca sin transpilación aparte, así
que juega bien con Tailwind v4 y la config de Vite sin el setup de Babel
que arrastra Jest. Un solo runner para tests de servidor y de componentes.
Costo: menos ejemplos oficiales de Next con Vitest que con Jest; los
Server Components asíncronos todavía no tienen un patrón de test cómodo
en ninguno de los dos.

## 2026-09-09 — Quedarse en Next.js 15, no saltar a la 16
Elegido: fijar `next@^15` en el scaffolding.
Descartado: arrancar directamente en Next 16 (ya disponible).
Por qué: la 15 está estable y con soporte; la 16 traía breaking changes
que no quería absorber junto con el arranque del proyecto.
Costo: `npm audit` reporta vulnerabilidades (esbuild/vite/postcss, todas
de tooling de dev/build, no de runtime de producción) que sólo se limpian
subiendo a la 16. Revisar la migración cuando haya algo de lógica real.

## 2026-09-13 — Alta de dueño+barbería vía RPC `register_owner`, no trigger
Elegido: función Postgres `SECURITY DEFINER` (`register_owner`) que inserta
`barbershops` y `users` en una sola transacción, llamada desde
`registerOwnerAction` tras `signUp()`.
Descartado: trigger `AFTER INSERT ON auth.users`.
Por qué: con un trigger, el nombre de la barbería y del dueño no están
disponibles en el momento del insert a `auth.users` (habría que pasarlos
por `raw_user_meta_data`, más frágil). El RPC explícito es más simple de
debuggear para un solo dev y deja la validación de "usuario ya tiene
perfil" como una excepción legible en vez de un trigger silencioso.
Costo: dos round-trips desde el Server Action (`signUp` + `rpc`) en vez de
uno; ver `docs/specs/01-infra-auth-multitenant.md` sección 5.1.

## 2026-09-13 — Migración SQL versionada sin proyecto Supabase linkeado
Elegido: escribir el schema/RLS/RPC de la spec 01 como
`supabase/migrations/20260913000000_infra_auth_multitenant.sql`, sin
ejecutarlo contra ninguna base.
Descartado: provisionar un proyecto Supabase real ahora (vía Vercel
Marketplace o CLI) para aplicar la migración en el momento.
Por qué: el repo no tenía `.env.local`, CLI de Supabase ni proyecto
linkeado en el momento de implementar la spec; se le preguntó al usuario
y prefirió dejar el SQL listo para aplicar después en vez de provisionar
infraestructura real dentro de esta tarea.
Costo: el código de `src/lib/supabase/*` y `src/actions/auth.actions.ts`
no está probado contra una base real todavía — sólo typecheck/lint/tests
con mocks. Hay que correr la migración (`supabase db push` o pegarla en
el SQL Editor) y cargar `.env.local` antes de probar el flujo end-to-end.
Actualización 2026-09-13: se linkeó el proyecto real (`supabase link`) y
se corrió `supabase db push` — la migración quedó aplicada y el flujo de
registro/login se probó de punta a punta en el navegador contra ese
proyecto. El costo de arriba ya no aplica.

## 2026-09-13 — RLS de `users` vía función `current_barbershop_id()`
Elegido: función `SECURITY DEFINER` `public.current_barbershop_id()` que
lee `barbershop_id` del usuario autenticado, referenciada desde las
policies de `barbershops` y `users`.
Descartado: policies que hacen `EXISTS (SELECT ... FROM users WHERE ...)`
directamente contra `users` dentro de la propia policy de `users`.
Por qué: una policy de `users` que consulta `users` en su propio `USING`
dispara recursión de RLS en Postgres. La función `SECURITY DEFINER`
rompe el ciclo porque lee sin pasar por RLS.
Costo: hay que confiar en que esa función esté bien acotada (solo
lectura de `barbershop_id`, `stable`) — cualquier cambio ahí afecta
todas las políticas multi-tenant.

## 2026-09-13 — "Confirm email" desactivado en Supabase Auth (por ahora)
Elegido: desactivar la confirmación de email en el proyecto de Supabase
(Authentication > Providers > Email), dejando el flujo de
`registerOwnerAction` tal cual (signUp → sesión activa → RPC
`register_owner`).
Descartado: mantener la confirmación activada y mover la creación de
perfil a un trigger `AFTER INSERT ON auth.users` con
`raw_user_meta_data`, para que no dependa de sesión activa.
Por qué: se detectó probando el registro real que con "Confirm email"
activo (default de Supabase) `signUp()` no devuelve sesión, así que el
RPC fallaba con "No hay sesión autenticada"; además el servicio de mail
compartido del free tier tiene un límite muy bajo y se agotó solo de
probar (`over_email_send_rate_limit`). Para la etapa trial/MVP, sin
necesidad todavía de verificar emails reales, desactivarlo es más simple
que rediseñar el alta atómica.
Costo: cualquiera puede registrarse con un email que no controla. Hay
que revisar esto (reactivar confirmación + SMTP propio, o migrar a
trigger) antes de tener usuarios reales pagando.

## 2026-09-13 — Redirect post-login/registro a `/agenda` con placeholder
Elegido: `loginAction`/`registerOwnerAction` no redirigen ellas mismas;
las páginas cliente (`login/page.tsx`, `registro/page.tsx`) llaman
`router.push("/agenda")` al recibir éxito. Se creó
`(dashboard)/agenda/page.tsx` como placeholder mínimo ("Agenda
(próximamente)") solo para tener un destino válido.
Descartado: redirigir a `/` (la landing pública, fuera del guard de
`(dashboard)`), o no redirigir nada y dejarlo indefinido para la spec de
agenda.
Por qué: la spec 01 no definía a dónde ir tras un login exitoso, y
`(dashboard)` no tenía ninguna página índice todavía. Se le preguntó al
usuario; `/agenda` es el destino más natural para un barbero aunque su
lógica real sea de otra spec.
Costo: `(dashboard)/agenda/page.tsx` habrá que reemplazarlo por completo
cuando se implemente la spec de agenda — no reusar su contenido.