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

## 2026-09-14 — `services`: borrado lógico (`is_active`), no `DELETE` físico
Elegido: `deleteServiceAction` hace `UPDATE services SET is_active = false`;
`getServicesAction` filtra `is_active = true`. Columna agregada a la tabla y
a `Service` en `src/types/index.ts` (no estaba en el modelo original de la
spec 02 ni de `arquitectura.md`).
Descartado: `DELETE FROM services` físico, tal como sugería la spec como
opción por defecto ("Desactiva o borra el servicio").
Por qué: la propia spec 02 (sección 5, "Integridad Referencial") advierte
que los turnos (`Appointments`, spec futura) van a referenciar
`service_id`, y un `DELETE` físico rompería ese historial o forzaría a
dejar la FK nullable. El borrado lógico es la opción que no hay que
deshacer después.
Costo: la tabla nunca se "limpia" sola; si hace falta un borrado real
(ej. GDPR/limpieza) habrá que agregarlo aparte. Cualquier query futura que
lea `services` sin pasar por `getServicesAction` tiene que acordarse de
filtrar `is_active = true`.

## 2026-09-14 — `services.barbershop_id` con `default current_barbershop_id()`, no seteado desde el Server Action
Elegido: la columna `barbershop_id` de `services` tiene
`default public.current_barbershop_id()` en la migración.
`createServiceAction` inserta solo `{ name, price, duration_minutes }`, sin
tocar `barbershop_id`.
Descartado: que el Server Action consulte `users` para obtener el
`barbershop_id` del usuario autenticado y lo mande explícito en el
`insert`, confiando en que la policy `WITH CHECK` de RLS lo valide.
Por qué: si el valor nunca sale del cliente/action, no hay nada que un
Server Action mal escrito (hoy o en el futuro) pueda "confundir" o
sobreescribir — la regla no-negociable #2 de `CLAUDE.md` ("RLS es la
barrera, no un `WHERE` a mano") queda reforzada a nivel de schema en vez
de depender de que cada action la respete. También evita un round-trip
extra a `users` en cada alta.
Costo: quien lea la migración tiene que saber que `current_barbershop_id()`
depende de `auth.uid()` (spec 01) — si algún día se inserta un servicio
fuera de una request autenticada (ej. un script admin), el default
resuelve `null` y el `insert` falla por el `not null`.

## 2026-09-14 — Dirección visual: tema claro fijo, acento "Tinta", sin modal
Elegido (a pedido del usuario, con mockups iterados en un Artifact antes de
tocar código real):
- Fondo blanco fijo — se saca `@media (prefers-color-scheme: dark)` de
  `globals.css`. No hay modo oscuro por ahora.
- Acento de marca "Tinta" (`#1f3a5f`), no naranja/latón (primera propuesta,
  rechazada) ni negro/blanco genérico.
- Tipografía: `Zilla Slab` (títulos, nombre de servicio, precio) + `Work
  Sans` (el resto), cargadas vía `next/font/google` en `layout.tsx`.
- `ServiceFormModal.tsx` (bottom sheet) reemplazado por
  `ServiceInlineForm.tsx`: al tocar "Editar" la fila se expande in-place
  dentro de la lista, sin overlay. "Nuevo servicio" abre el mismo
  componente arriba de la lista. Se borró `src/components/ui/Modal.tsx`
  por quedar sin uso.
Descartado: acento naranja/latón sobre fondo oscuro (primera propuesta);
tema adaptable a `prefers-color-scheme`; edición vía modal/bottom-sheet;
edición en pantalla completa y en panel lateral (alternativas mostradas,
no elegidas).
Por qué: al usuario no le gustó el naranja ni el popup ("muy rústico").
Se le ofrecieron 3 colores y 3 patrones de edición (fila expandible,
pantalla completa, panel lateral) como mockups interactivos; eligió tinta
+ fila expandible.
Costo: si más adelante se agrega modo oscuro, hay que diseñarlo de cero
(hoy no existe ningún token oscuro). El patrón de fila expandible no
escala bien si el formulario de edición crece mucho (ver nota en el
mockup) — si eso pasa, reconsiderar pantalla completa.

## 2026-09-14 — `services.price` como entero (guaraníes, sin decimales)
Elegido: columna `price` pasa de `numeric` a `integer` (migración
`20260914010000_services_price_integer.sql`), y `validateServicePayload`
en `service.actions.ts` exige `Number.isInteger(price)`. El precio se
muestra formateado con `formatGuaranies()` (`src/lib/utils.ts`), que usa
`Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG",
maximumFractionDigits: 0 })`.
Descartado: dejar `price` como `numeric`/decimal genérico, agnóstico de
moneda.
Por qué: el usuario aclaró que los precios son en guaraníes (PYG), que no
tiene subunidad — no existen "centavos" de guaraní. Validar y guardar
como entero evita datos imposibles (ej. ₲ 5.000,50) y simplifica el input
del formulario (`step="1"`).
Costo: si Clippr algún día soporta otra moneda con decimales (multi-tenant
con barberías en otro país), `price` como `integer` y la validación dejan
de servir — habría que agregar una columna de moneda por barbería y
condicionar la validación/formato a eso.

## 2026-09-14 — Activar/Desactivar servicio con switch optimista, no "Borrar"
Elegido: `deleteServiceAction` se reemplaza por
`toggleServiceStatusAction(id, isActive)` — recibe el estado destino
explícito (no "toggleá lo que haya"), para evitar carreras si el cliente
y el servidor quedan desincronizados. `getServicesAction` deja de filtrar
`is_active = true`: ahora devuelve todos los servicios (activos primero,
`order("is_active", { ascending: false }).order("name")`) para que la UI
pueda reactivar los inactivos. En `ServiceList.tsx` cada fila tiene un
`Switch` (`src/components/ui/Switch.tsx`) en vez de un botón de borrar,
con `useOptimistic` + `useTransition`: el switch cambia visualmente al
tocarlo, antes de que responda el servidor.
Descartado: mantener `deleteServiceAction` (borrado lógico de una sola
dirección, sin forma de reactivar desde la UI) y actualizar la lista
recién después de que el Server Action resuelva (patrón pesimista, como
en `createServiceAction`/`updateServiceAction`).
Por qué: pedido explícito del usuario — un servicio temporalmente no
disponible (de temporada, barbero de licencia) es un caso más común que
un borrado definitivo, y una barra de estado va mejor con feedback
instantáneo que con un botón de "Borrar" que espera al servidor.
Costo: la lista ahora siempre incluye inactivos (atenuados con
`opacity-40`), así que puede crecer más de lo que crecía antes con el
filtro; si el catálogo de una barbería llega a tener muchos servicios
inactivos acumulados, capaz haga falta paginar o separar en una sección
aparte. El optimismo del switch puede parpadear un instante si
`toggleServiceStatusAction` falla (RLS, red) — se revierte solo al
recibir la respuesta, pero el usuario ve el estado "incorrecto" por un
momento.

## 2026-09-14 — "Eliminar" dentro de Editar reutiliza el toggle, no borra de verdad
Elegido: `ServiceInlineForm.tsx` agrega un botón "Eliminar" (estilo
`danger`), visible solo al editar un servicio existente (no al crear uno
nuevo), que llama a `toggleServiceStatusAction(service.id, false)` — el
mismo Server Action que usa el `Switch` — y cierra el formulario al
terminar.
Descartado: agregar un `deleteServiceAction` nuevo que haga un `DELETE`
físico de la fila.
Por qué: pedido del usuario de tener un botón "Eliminar" accesible desde
la pantalla de edición, sin volver a abrir la discusión de integridad
referencial ya resuelta (`Appointments` futuros van a referenciar
`service_id`). Como ya existía un mecanismo reversible y seguro
(`toggleServiceStatusAction`), "Eliminar" es solo otra entrada a ese mismo
mecanismo, en vez de un camino nuevo y irreversible.
Costo: el nombre "Eliminar" puede generar expectativa de que el servicio
desaparece para siempre; en los hechos es indistinguible de apagar el
switch. Si más adelante hace falta un borrado permanente real (limpieza
de datos, GDPR), hay que diseñarlo aparte — no está cubierto por este
botón.

## 2026-09-14 — Gestión de equipo: fila expandible en vez del `BarberFormModal` (bottom sheet) de la spec
Elegido: `BarberInlineForm.tsx`, mismo patrón que `ServiceInlineForm.tsx` —
"Agregar Barbero" abre el formulario arriba de la lista y "Editar" expande
la fila in-place, sin overlay.
Descartado: `BarberFormModal.tsx` como bottom sheet, tal como lo pedía
`docs/specs/03-gestion-de-equipo.md` (sección 2).
Por qué: la spec 03 se escribió antes de la decisión de dirección visual
del 2026-09-14 (más arriba en este archivo), que abandonó el patrón
modal/bottom-sheet para todo el catálogo y borró `Modal.tsx` por quedar sin
uso. Implementar un bottom sheet nuevo solo para esta pantalla habría sido
inconsistente con esa decisión ya tomada. Se le consultó al usuario antes
de elegir (instrucción explícita de parar si algo de la spec no cerraba) y
confirmó seguir el patrón de fila expandible.
Costo: quien lea la spec 03 tal cual está escrita va a esperar un
componente `BarberFormModal.tsx` que no existe; hay que leer esta entrada
para entender por qué se llama distinto y se ve distinto.

## 2026-09-14 — `createBarberAction`: `barbershop_id` explícito desde el perfil del dueño, no `default current_barbershop_id()`
Elegido: `createBarberAction` lee primero el perfil (`id, barbershop_id,
role`) del usuario autenticado y usa ese `barbershop_id` explícito en el
`insert` a `public.users`, hecho con el cliente normal (sesión del dueño,
con RLS) — no con el cliente admin.
Descartado: agregarle a la columna `users.barbershop_id` un
`default public.current_barbershop_id()`, igual al patrón ya usado en
`services` (ver entrada del 2026-09-14 sobre `services.barbershop_id`).
Por qué: ese patrón evita que un Server Action "confunda" o sobreescriba el
tenant porque el valor nunca sale de la fila que se está creando en el
propio `insert`. Acá el valor tampoco sale del cliente/payload (viene de
una fila que el propio Server Action leyó del perfil del dueño, protegida
por RLS), así que el riesgo que ese patrón evita no aplica. Se prefirió no
tocar el schema de `users` para una spec que no pedía cambios de
base de datos (sección 2 de la spec: "Opcional si ya existe de la Spec
01"), y mantener la inserción del perfil en el cliente normal (no el
admin) para que la policy `users_insert_same_barbershop` también corra
como capa extra sobre el chequeo de rol.
Costo: si en el futuro se agrega otro punto de inserción a `users` fuera de
esta acción, ese código tiene que acordarse de setear `barbershop_id` a
mano — a diferencia de `services`, acá no hay una red de seguridad a nivel
de columna.