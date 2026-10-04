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

## 2026-09-15 — `cash_sessions`: nueva función `current_user_id()`, mismo patrón que `current_barbershop_id()`
Elegido: función `SECURITY DEFINER` `public.current_user_id()` (devuelve el
`id` de `public.users` del autenticado) para poder default-ear `user_id` en
el `insert` de `cash_sessions` (igual que `barbershop_id` con
`current_barbershop_id()`) y para las policies `cash_sessions_insert_own` /
`cash_sessions_update_own`.
Descartado: resolver el `user_id` a mano en `openCashSessionAction`
(consultando `users` por `auth_id`, como ya hace `getCurrentUserId` en el
mismo archivo para `getCurrentCashSessionAction`) y mandarlo explícito en
el `insert`, confiando en la policy `WITH CHECK` de RLS para validarlo —
mismo patrón que `createBarberAction` (ver entrada anterior).
Por qué: acá sí aplica la razón que en `createBarberAction` no aplicaba:
`openCashSessionAction` inserta una fila nueva a nombre del propio usuario
autenticado (no de un perfil ajeno recién creado), exactamente el caso que
`services.barbershop_id` con columna default ya resuelve — que el valor
nunca salga del Server Action es una red de seguridad extra a nivel de
schema, y evita un round-trip a `users` en el insert.
Costo: ahora hay dos funciones `SECURITY DEFINER` casi idénticas
(`current_barbershop_id()`, `current_user_id()`); si `appointments` (spec
futura, también tiene `user_id`) necesita el mismo patrón, va a ser la
tercera policy que dependa de esto — evaluar en ese momento si conviene
consolidar.

## 2026-09-15 — `closeCashSessionAction`: `end_time`/`final_balance` calculados en el Server Action, no en un trigger de Postgres
Elegido: `end_time = new Date().toISOString()` y
`final_balance = initial_balance` (leído de un `select` previo) se calculan
en TypeScript, dentro de `closeCashSessionAction`, y se mandan en el
`update`.
Descartado: un trigger `BEFORE UPDATE` en `cash_sessions` que asigne
`end_time = now()` y `final_balance` al detectar la transición
`open -> closed` (evita por completo que el Server Action toque
timestamps), o una función RPC `close_cash_session` al estilo
`register_owner`.
Por qué: la spec 04 (sección 5) pide no confiar en un timestamp mandado
"desde el cliente (Next.js)" porque el celular del barbero puede tener mal
la hora — pero un Server Action corre en el servidor, no en el celular, así
que su reloj es confiable; el riesgo real es un timestamp generado en un
Client Component y pasado como argumento, cosa que acá no pasa (`sessionId`
es el único argumento). Un trigger/RPC habría sido más "a prueba de balas",
pero `arquitectura.md` ya documentó preferir lógica en Server Actions por
sobre triggers/RPC en Postgres para un solo dev que debuggea en TypeScript
(ver "Las 3 Decisiones Técnicas Más Riesgosas..."); usarlo acá sin una
razón de atomicidad multi-tabla (a diferencia de `register_owner`, que sí
la tenía) hubiera sido inconsistente con esa decisión.
Costo: si en el futuro alguien actualiza `cash_sessions.status` a `closed`
por fuera de `closeCashSessionAction` (un script, otra acción), `end_time`
no se completa solo — a diferencia de un trigger, acá la garantía vive en
el código de la acción, no en el schema.

## 2026-09-15 — `OpenCashView`: tamaño de letra del monto según cantidad de dígitos, no `clamp()` con `vw`
Elegido: el input del saldo inicial calcula su `font-size` en JS a partir de
`amount.length` (`calcularTamanioFuente` en `OpenCashView.tsx`) — hasta 5
dígitos usa el tamaño máximo (4.5rem) y de ahí se achica 0.35rem por dígito
extra, con un piso de 1.75rem. También se reemplazó el símbolo `₲` por el
texto `"Gs."` (falta el glifo en `Zilla Slab` y renderizaba como una letra
rota) y se ocultaron las flechas nativas de incremento/decremento del
`<input type="number">` (`[appearance:textfield]` +
`[&::-webkit-*-spin-button]:appearance-none`).
Descartado: la primera versión usaba `font-size: clamp(2rem, 14vw, 4.5rem)`
(tamaño atado al ancho de la ventana).
Por qué: pedido explícito del usuario tras probar la pantalla ("no me gusta
la g", "si pasa de las 5 cifras el monto ya no se puede ver", "no me gusta
esa cosa de subir y bajar el número"). El `clamp()` con `vw` resultó ser la
causa real del segundo problema: en una ventana ancha, `14vw` supera el
máximo de 4.5rem para cualquier cantidad de dígitos, así que un número de 9
cifras no se achicaba nunca y desbordaba el contenedor — el navegador, para
mantener visible el cursor (al final del texto), recortaba el *principio*
del número en vez de mostrarlo completo. Encontrado probando en el
navegador con la extensión de Chrome, no reportado por el usuario
directamente. Atar el tamaño a `amount.length` en vez de al viewport
garantiza que el número siempre entre completo, sin importar el ancho de
pantalla.
Costo: los números de más de ~12 dígitos (saldos irreales para una caja
diaria) terminan en el piso de 1.75rem y podrían apretarse en un celular
muy angosto; no se validó ese caso extremo porque no es un escenario real
para un saldo inicial de caja.

## 2026-09-15 — `OpenCashView`: separador de miles en vivo, `input type="text"` en vez de `type="number"`
Elegido: el estado `amount` guarda solo dígitos (sin puntos); lo que se
muestra en el input es `Intl.NumberFormat("es-PY").format(...)` sobre esos
dígitos (`formatearConPuntosDeMiles`), recalculado en cada tecla. El input
pasa de `type="number"` a `type="text"` con `inputMode="numeric"` (un
`<input type="number">` no permite mostrar caracteres no numéricos como el
punto de miles). El tamaño de letra (`calcularTamanioFuente`) ahora se basa
en la longitud del texto ya formateado (dígitos + puntos), no solo en la
cantidad de dígitos, porque los puntos también ocupan espacio horizontal.
Como el cursor puede quedar en cualquier punto del número (no solo al
final) y la cantidad de puntos cambia con cada tecla, `handleAmountChange`
recalcula la posición del cursor contando cuántos dígitos había antes de él
y ubicándolo después de esa misma cantidad de dígitos en el texto
reformateado — sin esto, el cursor saltaría al final en cada tecla.
Descartado: dejar el monto sin separadores (como estaba) y sólo resolver
tamaño/glifo/spinners.
Por qué: pedido explícito del usuario ("se le puede poner un punto cada vez
que sea mil"). También preguntó por alternativas para que la letra no se
achique con números largos; se le respondió que las opciones (scroll
horizontal dentro del input, contenedor más ancho) no valen la pena porque
en el celular el achicamiento va a pasar igual — no se implementó nada de
eso, solo se ajustó el cálculo de tamaño para que cuente los puntos.
Costo: `handleAmountChange` es bastante más código que un simple
`setAmount(event.target.value)` por el manejo de cursor; si en el futuro
hace falta el mismo patrón de "monto con separador de miles" en otra
pantalla (agenda, productos), conviene extraer esto a un hook/componente
compartido en vez de copiar la función — no se hizo ahora porque `OpenCashView`
es el único lugar que lo necesita.

## 2026-09-15 — `cash_sessions`: `SELECT` alcanza a toda la barbería, `INSERT`/`UPDATE` solo al dueño de la fila
Elegido: la policy `cash_sessions_select_same_barbershop` deja ver
cualquier caja de la propia barbería (`barbershop_id = current_barbershop_id()`),
mientras que `cash_sessions_insert_own` / `cash_sessions_update_own` exigen
además `user_id = current_user_id()`. `getCurrentCashSessionAction` filtra
igual por `user_id` a nivel de aplicación para mostrar "mi" caja, no la de
un compañero.
Descartado: acotar también el `SELECT` a `user_id = current_user_id()`
(mismo criterio que insert/update), de forma que un barbero no pueda leer
ninguna fila de `cash_sessions` que no sea la suya.
Por qué: la spec 04 (sección 5) solo exige que un barbero no pueda *abrir o
cerrar* la caja de otro — no dice nada sobre lectura. `services` y
`equipo` (specs 02 y 03) ya establecieron el patrón de que, dentro de una
misma barbería, los datos operativos son visibles para todo el equipo y el
control fino de permisos se hace en el `INSERT`/`UPDATE`, pensando en que
el dueño va a necesitar ver la caja de cada barbero para las estadísticas
de la spec 08 (`docs/backlog.md`) sin tener que rediseñar RLS en ese
momento. No se le consultó al usuario porque es consistente con ese patrón
ya establecido, no una decisión nueva de aislamiento.
Costo: si más adelante se decide que un barbero *no* debería poder ver el
saldo inicial de la caja de otro barbero (privacidad entre compañeros,
no entre tenants), hay que agregar una policy de `SELECT` más estricta y
ajustar cualquier pantalla que hoy asuma que puede leer `cash_sessions` de
toda la barbería sin querer decir "todas son mías".

**Revertida el mismo día — ver la entrada siguiente.** El "Costo" de arriba
se terminó cumpliendo antes de terminar la sesión: era un riesgo real, no
hipotético.

## 2026-09-15 — `cash_sessions`: `SELECT` también acotado a `user_id = current_user_id()` (revierte la decisión anterior)
Elegido: la policy `cash_sessions_select_own` (migración
`20260915010000_cash_sessions_select_own_only.sql`) reemplaza a
`cash_sessions_select_same_barbershop`. Ahora `SELECT`, `INSERT` y
`UPDATE` exigen los tres `barbershop_id = current_barbershop_id() and
user_id = current_user_id()` — un barbero no puede leer, abrir ni cerrar
la caja de un compañero, ni siquiera dentro de la misma barbería.
Descartado: mantener el `SELECT` tenant-wide de la entrada anterior.
Por qué: advertencia del usuario — en la cultura de las barberías, cuánto
factura cada barbero en el día suele ser información semiprivada entre
compañeros, no algo que el dueño quiera exponer a todo el equipo. Con la
policy anterior, el Barbero A podía leer el saldo del Barbero B con
`supabase.from('cash_sessions').select('*')` desde la consola del
navegador, usando su propia sesión ya autenticada — sin explotar nada,
es la API pública del proyecto: RLS es la barrera real, no lo que la UI
decide mostrar. Verificado con un script descartable contra el proyecto
real: antes del fix el `SELECT` cruzado devolvía la fila; después, cero
filas. Además, el razonamiento original ("pensando en reportes del dueño a
futuro") pedía más acceso del que esa necesidad futura realmente requiere:
cuando se construya la spec de estadísticas (backlog #8), lo correcto es
que *solo el dueño* (`role = 'owner'`) vea las cajas ajenas, no cualquier
barbero.
Costo: cuando se implemente esa spec de estadísticas va a hacer falta una
policy de `SELECT` nueva y más específica (ej. `user_id =
current_user_id() OR (barbershop_id = current_barbershop_id() AND` el que
consulta es dueño`)`) — no alcanza con volver a abrir el `SELECT` a toda
la barbería como estaba.

## 2026-09-15 — `appointments`/`transactions`: mismo criterio estricto que `cash_sessions`, no "dueño ve todo" (spec 05)
Elegido: `appointments_select_own` / `appointments_insert_own` exigen
`barbershop_id = current_barbershop_id() and user_id = current_user_id()`,
igual que `cash_sessions_select_own`. `transactions` no tiene columnas
propias de tenant/usuario (no están en el modelo de `arquitectura.md`), así
que su aislamiento se resuelve con un `EXISTS` contra `cash_sessions` en
vez de policies directas — ver la entrada siguiente.
Descartado: lo que pedía literalmente la spec 05 ("el dueño ve todo lo de
su tenant, el barbero solo inserta/lee lo suyo"), que además se
contradecía a sí misma al decir en la misma sección "patrón similar a
`cash_sessions`" — `cash_sessions` hoy (ver la entrada de arriba) NO le da
al dueño visibilidad de las cajas ajenas.
Por qué: se le consultó al usuario porque la spec no cerraba sola (dos
frases contradictorias). Eligió mantener el criterio estricto ya vigente
en `cash_sessions` en vez de adelantar la funcionalidad "dueño ve todo el
tenant" — evita reabrir la misma discusión de privacidad entre compañeros
que ya se resolvió (y revirtió) el mismo día para `cash_sessions`, y no
requiere inventar una función de verificación de rol nueva ahora mismo.
Costo: igual que con `cash_sessions`, cuando se implemente la spec 08 de
estadísticas va a hacer falta una policy nueva (`... OR es dueño`) para que
el dueño pueda ver los turnos y transacciones de su equipo — no alcanza
con lo que hay hoy.

## 2026-09-15 — `transactions`: RLS vía `EXISTS` contra `cash_sessions`, sin denormalizar `user_id`/`barbershop_id`
Elegido: `transactions_select_own` / `transactions_insert_own` usan
`exists (select 1 from cash_sessions cs where cs.id =
transactions.cash_session_id and cs.user_id = current_user_id() and
cs.barbershop_id = current_barbershop_id())`. El `EXISTS` corre con los
privilegios de quien consulta, así que ya queda acotado por la propia
policy `cash_sessions_select_own` de la caja referenciada.
Descartado: agregar columnas `user_id`/`barbershop_id` a `transactions`
(con `default current_user_id()`/`default current_barbershop_id()`, mismo
patrón que `appointments`) para poder escribir policies directas sin
subquery.
Por qué: el modelo de `Transaction` en `docs/arquitectura.md` (heredado de
la spec original) no tiene esas columnas, solo `cash_session_id`. Agregar
columnas nuevas solo para simplificar la policy hubiera sido un cambio de
modelo no pedido por la spec 05; el `EXISTS` logra el mismo aislamiento
estricto sin tocar el schema documentado.
Costo: la policy es más cara de evaluar (un subquery por fila en vez de una
comparación directa) y más difícl de leer que una comparación simple. Si
`transactions` gana más políticas en el futuro (ej. la visibilidad de
dueño de la entrada anterior), puede valer la pena reconsiderar la
denormalización.

## 2026-09-15 — `completeWalkinAction`: `amount` y `end_time` calculados en el servidor, nunca confiados del payload
Elegido: el Server Action no recibe `amount` en el payload (a diferencia de
lo que sugería la spec 05, sección 4): lee `services.price` por
`serviceId` del lado del servidor y ese es el monto que se guarda en
`transactions`. Tampoco recibe `endTime`: se calcula con
`new Date().toISOString()` en el servidor, mismo criterio que
`closeCashSessionAction` (`cash.actions.ts`). `startTime` sí viene del
cliente (es el `startTime` local del timer de Zustand — no hay otra forma
de que el servidor lo conozca, ver regla #3/#4 de `CLAUDE.md`).
Descartado: implementar la firma tal cual la escribía la spec 05
(`{ serviceId, startTime, endTime, cashSessionId, amount }`, confiando en
`amount` y `endTime` del cliente).
Por qué: la regla no negociable #1 de `CLAUDE.md` ("actualizar balance de
caja... nunca calculado en el cliente") y el propio postmortem de v1
(`docs/aprendizajes-v1.md`: "cualquier usuario puede alterar las
peticiones HTTP y manipular la caja") describen exactamente este
escenario. No se le consultó al usuario porque es una regla ya escrita,
no una decisión de diseño abierta — se avisó igual antes de implementar.
Costo: si en el futuro se necesita cobrar un monto distinto al precio de
lista del servicio (descuento, propina, precio negociado), hay que
diseñar ese campo aparte con su propia validación server-side — no alcanza
con reabrir el parámetro `amount` del payload.

## 2026-09-15 — Pantalla principal de walk-ins en `/inicio`, no en `(dashboard)/page.tsx`; redirect post-login actualizado
Elegido: la pantalla de temporizadores vive en
`src/app/(dashboard)/inicio/page.tsx` (ruta `/inicio`).
`loginAction`/`registerOwnerAction` ahora redirigen a `/inicio` en vez de
`/agenda` (`login/page.tsx`, `registro/page.tsx`, y sus tests).
Descartado: `src/app/(dashboard)/page.tsx` como sugería la spec 05
("la ruta principal de trabajo del barbero"), manteniendo el redirect a
`/agenda`.
Por qué: `(dashboard)` es un grupo de rutas (los paréntesis no cuentan
para la URL), así que `(dashboard)/page.tsx` resuelve a la misma URL `/`
que ya ocupa `src/app/page.tsx` (la landing pública del scaffolding) —
Next.js tira error de ruta duplicada. Aparte, `/agenda` ya estaba
reservado para la spec 06 ("Agenda de Turnos Programados", ver la entrada
2026-09-13 "Redirect post-login/registro a `/agenda`" — "hay que
reemplazarlo por completo cuando se implemente la spec de agenda", que es
la 06, no esta). No se le consultó al usuario: es una restricción técnica
real (colisión de rutas), no una decisión de diseño con trade-offs.
Costo: cualquier lugar que todavía asuma `/agenda` como destino post-login
(documentación, links) queda desactualizado; hay que revisarlo si se
agrega navegación explícita entre pantallas del dashboard.

## 2026-09-15 — `timerStore`: `persist` con `skipHydration: true` + rehidratación manual post-mount
Elegido: el store de Zustand (`src/store/timerStore.ts`) usa
`persist(..., { name: "clippr-timers", skipHydration: true })`, y expone
`useTimerStoreHydrated()` — un hook que llama a
`useTimerStore.persist.rehydrate()` dentro de un `useEffect` y devuelve
`true` recién cuando termina. `TimerList` no renderiza la lista de timers
(ni el aviso de "sin temporizadores") hasta que ese hook devuelve `true`.
Descartado: `persist` con su comportamiento por defecto (rehidratar del
`localStorage` de forma síncrona al crear el store).
Por qué: en Next.js App Router el primer render de un Client Component
también corre en el servidor (SSR), donde no existe `localStorage`. Si
`persist` rehidratara de forma síncrona, el HTML del servidor (siempre
`timers: []`) no coincidiría con el primer pintado del cliente (ya con los
timers restaurados), y React tira un error de hydration mismatch — un
gotcha conocido de `zustand/persist` en frameworks con SSR. Verificado en
el navegador contra el proyecto real: sin este patrón no hubo error
visible en la consola en las pruebas hechas, pero el patrón es el
recomendado por la propia documentación de Zustand para evitarlo de raíz
en vez de confiar en que React lo recupere silenciosamente.
Costo: un frame extra donde la lista de timers no se pinta todavía
(oculta hasta que `hasHydrated` es `true`), en vez de mostrar `[]` y
luego "saltar" a los datos reales — la app tarda un instante más en
mostrar temporizadores existentes tras un F5, aunque no hay parpadeo
visible en la práctica.

## 2026-09-15 — Navegación minimalista (spec 05.5): sin doc de spec previo, se escribió a partir del pedido en el chat
Elegido: se creó `docs/specs/05.5-navegacion-minimalista.md` con el
contenido del pedido antes de implementar, siguiendo el patrón spec-first
ya establecido (specs 01-05).
Descartado: implementar directo desde las instrucciones del chat sin
dejar un doc de spec.
Por qué: el usuario pidió "basándote en docs/specs/05.5-...", pero ese
archivo no existía todavía — solo su mensaje lo describía. Se decidió
formalizarlo como archivo en vez de preguntar, porque el propio pedido ya
traía el nivel de detalle de una spec completa (pasos, regla de diseño
estricta) y todas las specs anteriores del proyecto siguen ese patrón.
Costo: ninguno relevante — es la forma esperada de trabajar en este repo.

## 2026-09-15 — Barra de navegación: Inicio / Caja / Agenda / Más (no Estadísticas)
Elegido: los 4 ítems fijos de `BottomNav.tsx` son Inicio (`Home`), Caja
(`Wallet`), Agenda (`Calendar`) y Más (`MoreHorizontal`, con Servicios y
Equipo adentro). `Estadísticas` queda fuera de la barra principal.
Descartado: usar Estadísticas como 4to ítem en vez de Agenda.
Por qué: el pedido del usuario no especificaba los 4 destinos ("los 4
íconos mencionados" asumía un doc de spec que no existía, ver la entrada
de arriba). `/agenda` ya tenía un placeholder (`(dashboard)/agenda/page.tsx`,
spec 01) mientras que `/estadisticas` ni siquiera tiene `page.tsx`
(carpeta vacía con `.gitkeep`) — usar Agenda evita crear una página nueva
solo para no dejar un ícono roto. Además Agenda (spec 06) es el siguiente
ítem del backlog después de esta rebanada, más alineado a un tab de uso
diario que Estadísticas (cadencia mensual, spec 08).
Costo: si más adelante se decide que Estadísticas sí necesita estar en la
barra principal, hay que revisar el orden/cantidad de ítems (¿reemplaza a
Agenda? ¿se suma un 5to?) — no hay una decisión tomada sobre eso todavía.

## 2026-09-15 — `BottomNav`: ítem activo por color y por grosor de trazo, no solo por color
Elegido: además de `text-accent` vs `text-muted`, el ícono activo usa
`strokeWidth={2.25}` contra `1.75` del resto.
Descartado: distinguir el ítem activo únicamente por color (como hace el
switch de servicios o el borde de "editar" en equipo).
Por qué: la regla estricta del pedido ("solo blanco, grises y Tinta para
el ícono activo") no dejaba margen para un fondo o un badge de color
distinto — con un solo canal de diferenciación (color, en una franja fija
de 5 íconos pequeños) el contraste podía ser difícil de notar a la luz del
día, uso real de una barbería. Variar el trazo no agrega un color nuevo,
así que no rompe la regla, y da una segunda señal visual redundante.
Costo: ninguno relevante — es una diferencia sutil de grosor, no un
cambio de layout.

## 2026-09-15 — Cabecera de `/inicio`: fetch de perfil propio en `page.tsx`, subtítulo estático sin números
Elegido: `InicioPage` hace su propia consulta a `users` (mismo patrón que
`(dashboard)/layout.tsx`: `auth.getUser()` + `.from("users").select("name").eq("auth_id", ...)`)
para mostrar el nombre del barbero como título. El subtítulo es texto fijo
("Cortes de hoy y tu racha"), sin números.
Descartado: pasar el nombre desde `layout.tsx` (que ya lo consulta para el
navbar superior) como prop/contexto; o mostrar un subtítulo con números de
ejemplo (ej. "3 cortes hoy · racha de 5 días").
Por qué: Next.js App Router no comparte datos entre un layout Server
Component y sus páginas hijas sin pasar por cookies/contexto — duplicar
una consulta liviana (`select name`) es más simple que armar ese
mecanismo para un solo dato, siguiendo el mismo criterio de cada
página resolviendo sus propios datos que ya usan `caja`, `servicios` y
`equipo`. Números de ejemplo se descartaron porque `cortes/racha` todavía
no tienen lógica real (spec 08): mostrar "3 cortes hoy" sin que sea cierto
podría leerse como un dato real y no como un placeholder de diseño — un
texto fijo sin cifras no genera esa confusión.
Costo: si `/inicio` gana más pantallas hermanas que también necesiten el
nombre del usuario, esa consulta se va a repetir — recién ahí valdría la
pena compartirla (context, o pasarla por el layout).

## 2026-09-15 — Tipografía: Inter reemplaza Work Sans + Zilla Slab
Elegido: una sola familia (`Inter`, vía `next/font/google`) para
`--font-sans` y `--font-display` en `globals.css`, cargada en
`layout.tsx`. Se sacaron `Work_Sans` y `Zilla_Slab`.
Descartado: `Geist` (fuente de Vercel, pedida explícitamente) — no está en
el catálogo de `next/font/google` de la versión de Next instalada
(15.5.x); sumar el paquete `geist` aparte se descartó para no meter una
dependencia nueva solo por esto, ya que el propio pedido dejaba "o Inter"
como alternativa válida. También se descartó mantener `Zilla Slab` para
títulos/precios (opción "Outfit + Inter" quedó explorada en el Artifact
como punto medio, sin implementar).
Por qué: pedido explícito de una identidad más "tech/prolija" estilo
Apple/Vercel, comparado primero en un Artifact ("Muestrario Clippr", con
contenido real: cabecera de `/inicio`, precios en guaraníes) antes de
tocar código, mismo criterio que la dirección visual del 14/09.
Costo: se pierde el toque distintivo que daba `Zilla Slab` a precios y
títulos — tipográficamente Clippr ahora se parece más a cualquier dev
tool (Vercel/Linear) que a una barbería. Si más adelante se quiere
recuperar identidad de marca ahí, "Outfit + Inter" quedó evaluada como
opción intermedia.

## 2026-09-15 — Íconos: trazo fino global en `BottomNav`
Elegido: el `strokeWidth` inactivo baja de 1.75 a 1.5 (el activo se
mantiene en 2.25).
Descartado: relleno sólido, duotono con placa de fondo activo, y glifos
geométricos — las tres quedaron exploradas en el Artifact pero no se
llevaron a código.
Por qué: mismo contrato ya documentado el 15/09 más arriba (distinguir el
activo por color **y** grosor de trazo) — solo se afinan los números
para que se sienta más liviano, sin agregar superficie de riesgo ni
romper esa regla.
Costo: ninguno relevante.

## 2026-09-15 — Sistema de botones: jerarquía + `active:scale-95`
Elegido: `Button.tsx` pasa a 4 variantes: `primary` (`bg-accent`),
`secondary` (`bg-surface-2`, sin borde), `ghost` (solo texto) y `danger`
(con borde, sin cambios). Las 4 suman `active:scale-95` (más
`disabled:active:scale-100`). De paso se corrigieron los botones de
submit de login/registro, que estaban en `bg-black` desde antes de la
decisión de acento "Tinta" del 14/09 y nunca se habían migrado — ahora
usan `<Button>`.
Descartado: mantener `secondary` con borde (como estaba antes) — pasa a
`bg-surface-2` para diferenciarse mejor de `ghost` y seguir la regla de
"un solo botón gritón por pantalla".
Por qué: pedido explícito de jerarquía de botones + sensación táctil
nativa, sin sumar sombras (los bordes siguen siendo la única separación
donde ya existían, salvo `danger`).
Costo: es un cambio global vía el componente compartido — todo call-site
con `variant="secondary"` cambió de aspecto (de borde a fondo gris) sin
tocar cada archivo. A revisar si en algún lugar puntual el borde cumplía
un propósito no documentado.

## 2026-09-15 — Rediseño de `/inicio` y el layout del dashboard
Elegido:
- `(dashboard)/layout.tsx` pierde el `<nav>` superior (nombre de la
  barbería + "Cerrar sesión"): el logout ya vive en `/mas`. La consulta a
  `profile`/`barbershopName` y el import de `logoutAction` se borraron
  con él — el layout ahora solo hace de guard de sesión.
- La cabecera de `/inicio` pasa a "Hola, {nombre de pila}" + dos píldoras
  monocromas (`bg-surface-2`, sin color nuevo) con ícono + texto ("Cortes
  de hoy" / "Tu racha"), sin números.
- La fila input-chico + botón-chico de `TimerList.tsx` se reemplaza por
  un botón de ancho completo ("Iniciar corte") como CTA principal, con
  `active:scale-[0.98]`. El input "Servicio (opcional)" se conserva, más
  chico, arriba del botón.
- El estilo final del botón es **contorno** (borde 1.5px en Tinta, fondo
  blanco, texto e ícono en Tinta) — no relleno sólido.
Descartado: emoji en el saludo, píldora "Racha" en naranja, y números
hardcodeados ("0 cortes hoy") — las tres se propusieron en una primera
pasada y se descartaron por chocar con reglas ya tomadas (cero emojis del
14/09; naranja rechazado como acento el 14/09; "sin números" decidido el
15/09, ver entrada de arriba). También se descartó sacar el input de
servicio por completo: sigue siendo la única forma de distinguir timers
concurrentes (`CLAUDE.md`, sección "Timers"). Para el botón en sí se
probaron 4 variantes más (relleno con insignia circular, relleno sin
insignia, compacto junto al input, franja con flecha) en el Artifact
antes de elegir el contorno.
Por qué: pedido explícito de una pantalla de inicio "premium", con un
solo botón de acción grande y sin fricción para arrancar un walk-in; el
contorno se eligió por sobre el relleno sólido porque ocupa el mismo
espacio pero pesa menos visualmente en la pantalla.
Costo: ninguna migración ni cambio de datos — es puramente visual/
estructural. Al sacar la barra superior, el nombre de la barbería ya no
se muestra en ningún lado del dashboard.
visible en la práctica.

## 2026-09-16 — `appointments`: falta política RLS de `update` (spec 06)
Elegido: nueva migración `20260916010000_appointments_update_own.sql` con
`appointments_update_own`, una policy `for update using (barbershop_id =
current_barbershop_id() and user_id = current_user_id())` — mismo criterio
estricto que `appointments_select_own` / `appointments_insert_own` (spec
05) y el mismo patrón (`using` sin `with check`) que
`cash_sessions_update_own` (spec 04).
Descartado: nada — no había alternativa real, la policy faltaba directo.
Por qué: la spec 06 pide que `completeScheduledAppointmentAction` y
`cancelAppointmentAction` hagan `UPDATE` sobre `appointments` para pasar
un turno de `scheduled` a `completed`/`cancelled`, pero la migración de la
spec 05 (`20260916000000_create_appointments_and_transactions.sql`) solo
creó políticas de `select` e `insert` — no hacía falta `update` porque el
flujo de walk-ins inserta el `appointment` directo en `completed`, nunca
lo actualiza. Sin la policy nueva, RLS bloquea cualquier `UPDATE` en
silencio (0 filas afectadas) y ninguna de las dos actions de la spec 06
podía funcionar. Se consultó al usuario porque la spec no cerraba sola
(daba por sentado que las políticas "ya existentes" alcanzaban); confirmó
agregar la policy con este criterio antes de seguir.
Costo: igual que el resto de `appointments`/`cash_sessions`, cuando la
spec 08 de estadísticas le dé al dueño visibilidad del equipo va a hacer
falta revisar si también necesita poder actualizar turnos ajenos (hoy no
puede). Migración aplicada contra el proyecto real con `supabase db push`
(quedó bloqueada por permisos al principio de la sesión; el usuario
confirmó aplicarla, ver `docs/deuda-tecnica.md`).

## 2026-09-16 — Fechas del negocio en `America/Asuncion`, resueltas en el servidor
Elegido: `src/lib/dates.ts` (sin librerías, con `Intl`) calcula "hoy", los
cortes de día `[00:00, 00:00 del día siguiente)` y el instante de un turno
en la zona `America/Asuncion`. `scheduleAppointmentAction` ahora recibe
`dateISO` + `time` (HH:MM) por separado en vez de `startTimeISO`, y es el
servidor el que arma el instante.
Descartado: (1) seguir cortando los días en UTC — la prueba en el
navegador mostró que un turno de las 21:30 aparecía en el día siguiente;
(2) mandar el instante ya armado desde el celular, como pedía la spec 06
(`startTimeISO`) — depende de que el dispositivo tenga bien configurada la
zona; (3) un offset fijo de -3 — la zona IANA sigue siendo correcta si
Paraguay vuelve a cambiar de horario; (4) `date-fns-tz` u otra librería —
`Intl` alcanza para esto.
Por qué: el servidor corre en UTC y en Paraguay, desde las 21:00, UTC ya es
el día siguiente. Resolver todo con la zona del negocio en un solo lugar
evita que servidor, base y celular discrepen sobre qué día es.
Costo: la zona está fija para todas las barberías (ver
`docs/deuda-tecnica.md`). El payload de `scheduleAppointmentAction` ya no
coincide con la spec 06.

## 2026-09-16 — Cobrar un turno antes de hora corre `start_time`; no se cobran turnos de días futuros
Elegido: en `completeScheduledAppointmentAction`, si el cobro ocurre antes
de la hora agendada, además de `end_time = ahora` se guarda
`start_time = ahora − duración del servicio`. Si el turno es de un día
posterior a hoy (hora de Paraguay), el cobro se rechaza.
Descartado: dejar `start_time` como estaba (la prueba en el navegador dejó
un turno con `end_time` anterior a `start_time`) y `end_time =
max(start_time, ahora)` (inventaría un fin en el futuro para un corte que
ya terminó).
Por qué: la duración de cada corte tiene que ser siempre positiva y
realista para las estadísticas de la spec 08. Sin el bloqueo de días
futuros, cobrar hoy un turno de mañana lo movería al día de hoy. Lo
propuso el usuario (rol arquitecto) y se aceptó el bloqueo recomendado.
Costo: la hora agendada original se pierde al cobrar antes de hora (ver
`docs/deuda-tecnica.md`).

## 2026-09-16 — Saldo de caja calculado en el servidor, el mismo para la pantalla y el cierre
Elegido: `computeBalance` (privada en `cash.actions.ts`) suma saldo
inicial + ingresos − egresos leyendo `transactions`. La usan
`getCashBalanceAction` (pantalla `/caja`) y `closeCashSessionAction`
(`final_balance`). Si no se pueden leer las transacciones, la caja no se
cierra.
Descartado: mostrar el saldo real solo en `/caja` y dejar el cierre como
estaba — pantalla y cierre darían números distintos. También se descartó
sumar el saldo dentro de `getCurrentCashSessionAction`, porque `/inicio` y
`/agenda` la llaman solo para saber si hay caja abierta y pagarían una
consulta extra.
Por qué: el barbero tiene que ver cuánta plata hay en la caja, y el cierre
tiene que guardar ese mismo número (regla 1 de CLAUDE.md: el cálculo va en
el servidor).
Costo: la suma se hace en JS sobre las filas del día, no con un `SUM` en
SQL. Alcanza para el volumen de una caja diaria.
## 2026-09-16 — Productos: solo el dueño edita el catálogo; RLS de `update` abierta a toda la barbería
Elegido: `createProductAction`, `updateProductAction` y
`toggleProductStatusAction` leen el rol del usuario y rechazan a quien no
sea `owner` (mismo chequeo que `team.actions.ts`). Las policies de
`products` quedan como pedía la spec 07: `select`/`insert`/`update` con
`barbershop_id = current_barbershop_id()`, sin policy de `delete` (borrado
lógico con `is_active`, igual que `services`). En `/productos` los
barberos ven la lista sin switch ni botón de editar.
Descartado: que cualquier integrante edite el catálogo (criterio actual de
`services`), y acotar el `UPDATE` de RLS al dueño.
Por qué: la spec 07 dejaba la regla abierta ("sugerido: ... igual que en
equipo"); se le consultó al usuario y eligió solo el dueño. El `UPDATE` de
RLS no se puede cerrar al dueño porque cualquier barbero descuenta stock al
vender (`sellProductAction`).
Costo: desde la consola del navegador, un barbero puede cambiar el precio o
el stock de un producto con su propia sesión — RLS no lo frena, solo el
Server Action. Si eso llega a importar, hace falta una RPC de venta
`SECURITY DEFINER` (que también resolvería la atomicidad, ver
`docs/deuda-tecnica.md`) y cerrar el `UPDATE` al dueño.

## 2026-09-16 — `transactions_insert_own` exige caja abierta (`status = 'open'`)
Elegido: migración `20260916030000_transactions_insert_open_session_only.sql`
recrea `transactions_insert_own` sumando `cs.status = 'open'` al `EXISTS`.
Además, `registerTransactionAction` y `sellProductAction` buscan en el
servidor la caja abierta del usuario (el cliente nunca manda
`cashSessionId`) y cortan antes si no hay.
Descartado: dejar el chequeo solo en los Server Actions, como hacen
`completeWalkinAction` y `completeScheduledAppointmentAction`.
Por qué: la spec 07 (sección 5.3) daba por hecho que RLS ya bloqueaba
movimientos en una caja cerrada, pero la policy de la spec 05 solo
verificaba que la caja fuera propia. Se le consultó al usuario y eligió que
la base sea la barrera real, además del Server Action.
Costo: ninguna acción puede insertar una transacción en una caja cerrada,
ni siquiera para corregir un cierre (hoy ningún flujo lo necesita). Si se
agrega un "ajuste posterior al cierre", va a necesitar otra policy o una
RPC.

## 2026-09-16 — `sellProductAction`: descuento de stock condicionado al stock leído
Elegido: el `update` de stock filtra `.eq("stock", stockLeído)`. Si otro
barbero vendió entre la lectura y la escritura, no se actualiza ninguna
fila y se devuelve "El stock cambió mientras vendías. Intentá de nuevo.".
La tabla además tiene `check (stock >= 0)`. El monto de la venta sale de
`products.price × cantidad` leído en el servidor. Vender un producto
inactivo se rechaza.
Descartado: `update stock = stock - n` sin condición (con supabase-js no
se puede expresar sin RPC) y leer-y-escribir sin condición (dos ventas
simultáneas pisarían el stock).
Por qué: una barbería con varios barberos vende del mismo stock; sin la
condición se pierden descuentos en silencio. La spec 07 pedía abortar si
la cantidad supera el stock, y esto cubre también el caso concurrente.
Costo: con mucho tráfico sobre un mismo producto el barbero puede tener
que reintentar. Sigue sin haber atomicidad entre el stock y la transacción
(ver `docs/deuda-tecnica.md`).

## 2026-09-16 — Lógica del monto con separador de miles extraída a `useAmountInput`
Elegido: el manejo del input de monto de `OpenCashView` (solo dígitos en el
estado, puntos de miles al mostrar, reposición del cursor) pasó a
`src/components/forms/useAmountInput.ts`. Lo usan `OpenCashView` y
`TransactionInlineForm`.
Descartado: copiar la lógica en el formulario nuevo.
Por qué: la spec 07 pide reutilizar el comportamiento de `OpenCashView`, y
es la lógica de UI más propensa a romperse (ver `docs/deuda-tecnica.md`):
mejor un solo lugar para arreglarla.
Costo: `OpenCashView` se tocó sin tests de UI que lo cubran; se revisó a
mano que el comportamiento sea el mismo y después se probó en el navegador
(abrir caja con 50.000 mostró "50.000"), pero sigue sin test automatizado.

## 2026-09-16 — Contraseña temporal aleatoria por barbero + cambio opcional, no cambio forzado en el primer login
Elegido: `createBarberAction` genera una contraseña temporal de 6
caracteres (`generateTemporaryPassword` en `src/lib/passwords.ts`:
`crypto.randomInt`, mayúsculas y dígitos sin 0/O/1/I/L, al menos una letra y
un dígito) y la devuelve una sola vez; `BarberInlineForm` se la muestra al
dueño con "Copiar" y "Listo", y no se guarda ni se loguea en ningún lado.
Nueva pantalla `/mas/cambiar-password` (`changePasswordAction` en
`auth.actions.ts`) para que cualquiera cambie la suya, pidiendo la actual.
Reemplaza a `PASSWORD_POR_DEFECTO = "Clippr2026!"`, igual para todos.
Descartado: (1) cambio obligatorio en el primer login (columna
`needs_password_change`, intercepción en `layout.tsx`, redirecciones) —
sobre-ingeniería para la beta; (2) invitación por email de Supabase —
depende de tener el envío de mails configurado ("Confirm email" está
desactivado). Queda como Fase 2.
Por qué: decisión del usuario ("Fase 1: MVP y beta cerrada"). Una contraseña
fija en el repo le daba a cualquiera acceso a todas las cuentas de
barberos. Se pide la contraseña actual para cambiarla (y se verifica con
`signInWithPassword`, porque `updateUser` de Supabase no la pide): sin eso,
alguien con el celular desbloqueado y la sesión abierta podría dejar al
barbero afuera.
Costo: 6 caracteres sobre 31 símbolos (~887 millones de combinaciones)
depende del rate limit de login de Supabase para no ser adivinable; si el
barbero nunca la cambia, esa es su contraseña para siempre. Si el dueño
cierra el panel sin anotarla, no hay forma de verla ni de regenerarla desde
la app (ver `docs/deuda-tecnica.md`). Los barberos creados antes de este
cambio siguen con `Clippr2026!`.

## 2026-09-17 — Niveles como "ligas" de 30 días móviles, no como acumulado histórico
Elegido: el `level` del barbero se recalcula al cerrar la caja contando sus
turnos `completed` de los últimos 30 días (ventana móvil): junior < 40, pro
40–90, senior 91–150, élite 151+. Puede **bajar**. Umbrales y cálculo en
`src/lib/levels.ts` (`levelForCuts`, `levelProgress`), fuera del Server
Action.
Descartado: (1) umbrales sobre cortes acumulados de toda la historia
(junior 0 / pro 50 / senior 200 / elite 500), la propuesta inicial; (2)
umbrales sobre `streak_count`; (3) combinar cortes Y racha.
Por qué: la spec 08 solo daba un ejemplo ("ej. a Pro") sin umbrales, así que
se le consultó al usuario. Eligió el modelo de ligas (estilo rangos de un
juego competitivo): con un acumulado histórico el nivel se gana una vez y el
juego se termina; con una ventana móvil el barbero tiene que sostener el
ritmo para mantener la categoría, que es justo el objetivo de retención de
la gamificación. El acumulado además castiga al barbero nuevo para siempre.
Costo: un barbero que se va de vacaciones vuelve con el nivel más bajo, y
eso puede leerse como un castigo más que como un incentivo — no hay ninguna
pantalla que explique por qué bajó, más allá de la línea "tu nivel se
calcula sobre los últimos 30 días" en `/estadisticas`. La ventana se
recalcula sólo al cerrar la caja, así que el nivel guardado puede quedar
desactualizado si el barbero deja de cerrar cajas (ver
`docs/deuda-tecnica.md`).

## 2026-09-17 — Racha con un día de gracia, en vez de modelar días hábiles
Elegido: al cerrar una caja con al menos un ingreso, se compara el día del
negocio de su `start_time` contra la última jornada válida anterior (otra
caja cerrada con ingresos). Diferencia de 1 o 2 días → racha +1; 0 días
(segunda caja del mismo día) → sin cambio; 3 días o más → vuelve a 1. Lógica
pura en `src/lib/streaks.ts` (`nextStreakCount`), llamada desde
`updateStreakAndLevel` en `cash.actions.ts`.
Descartado: (1) día calendario anterior estricto, sin tolerancia; (2)
hardcodear el domingo como día no laborable para todas las barberías.
Por qué: la spec 08 hablaba de "más de 1 día hábil sin caja", pero el
proyecto no tiene noción de días hábiles ni de horarios por barbería, así
que se le consultó al usuario y eligió la tolerancia de 48 hs. Una barbería
cierra los domingos y otra los lunes: el día de gracia cubre las dos sin
agregar ninguna configuración, y además le da al barbero un comodín para el
día que falta por un trámite, que es lo que evita que abandone la racha (y
la app) después de una falta.
Costo: "racha de 10" ya no significa 10 días seguidos — pueden ser 10
cierres repartidos en hasta 20 días. El texto de `/inicio` y
`/estadisticas` dice "racha de N días" sin esa aclaración.

## 2026-09-17 — RLS: el dueño ve las cajas, turnos y movimientos de su equipo
Elegido: migración `20260917000000_owner_stats_visibility.sql` con la función
`public.current_user_role()` (`SECURITY DEFINER`, mismo patrón que
`current_barbershop_id()` / `current_user_id()`) y las tres policies de
`select` reescritas como `barbershop_id = current_barbershop_id() and
(user_id = current_user_id() or current_user_role() = 'owner')`. En
`transactions` el criterio va adentro del `EXISTS` contra `cash_sessions`.
`insert` y `update` no se tocaron: el dueño lee, no escribe sobre lo ajeno.
Descartado: la fórmula literal de la spec (`user_id = current_user_id() OR
(barbershop_id = current_barbershop_id() AND role = 'owner')`) — es
lógicamente equivalente, pero deja el chequeo de tenant sólo en una de las
dos ramas. Poniéndolo como primer factor común, la barrera multi-tenant
(regla 2 de CLAUDE.md) se lee de un vistazo y no depende del rol.
Por qué: era el paso que las specs 05 y 06 ya habían dejado anotado ("queda
para cuando se implemente la spec 08"). Sin esto, el dashboard del dueño no
puede ver un solo dato de su equipo.
Costo: **`/agenda` tuvo que empezar a filtrar `user_id` a mano**
(`getAgendaAction`), porque hasta ahora se apoyaba en que RLS le devolviera
sólo los turnos propios — sin ese filtro, el dueño vería la agenda de toda
la barbería mezclada en su día. Es un filtro de pantalla, no de tenant (eso
lo sigue haciendo RLS), pero es exactamente el tipo de query que hay que
revisar cada vez que una policy se afloja: cualquier consulta futura que
asuma "RLS ya me acota a lo mío" sobre `cash_sessions`, `appointments` o
`transactions` está mal. También: el dueño ahora puede leer el saldo de la
caja de un barbero pasando su id a `getCashBalanceAction`.

## 2026-09-17 — La gamificación no puede tumbar el cierre de caja
Elegido: `updateStreakAndLevel` corre **después** del `update` que cierra la
caja, no devuelve error y no se propaga: si falla, se loguea y
`closeCashSessionAction` devuelve igual `{ success: true }`.
Descartado: calcular racha y nivel antes del cierre, o abortar el cierre si
la gamificación falla.
Por qué: el cierre de caja es el registro contable del día; la racha es un
número motivacional. Hacerle creer al barbero que su cierre no se guardó
(cuando sí se guardó) por un fallo en una consulta de estadísticas es mucho
peor que perder un punto de racha.
Costo: una racha puede quedar sin sumar en silencio y no hay forma de
recalcularla después (no hay job de reconciliación) — ver
`docs/deuda-tecnica.md`.

## 2026-09-17 — "Cobrado hoy" se recorta por `transactions.created_at`, no por el día de apertura de la caja
Elegido: `sumIncome` (`stats.actions.ts`) filtra los movimientos por
`created_at` dentro del rango, y busca las cajas por **intersección** con ese
rango (`start_time < fin` y `end_time >= inicio or end_time is null`) en vez
de por día de apertura. Las cajas siguen sirviendo para saber de quién es
cada movimiento (`transactions` no tiene `user_id`), no para recortar el
tiempo.
Descartado: recortar por `cash_sessions.start_time`, que era la primera
implementación.
Por qué: lo encontró la prueba en el navegador contra el proyecto real. El
barbero tenía una caja abierta el 16/09 a las 21:27 y todavía sin cerrar; al
cobrar un corte el 17, `/estadisticas` mostraba **"1 corte hoy" junto a
"Gs. 0 cobrado hoy"** — los cortes se contaban por `appointments.start_time`
(día calendario) y la plata por el día de apertura de la caja, así que las
dos mitades de la misma pantalla hablaban de días distintos. Una caja que el
barbero se olvidó de cerrar no tiene por qué sacar del día de hoy lo que se
cobró hoy.
Costo: una jornada nocturna que cruza la medianoche se parte en dos días,
que es el reverso del mismo problema — pero es el corte que ya usan los
cortes y la agenda, así que al menos toda la app corta el día igual. La
racha es la única que sigue mirando `cash_sessions.start_time`, y eso es a
propósito (caso borde 3 de la spec: cerrar a las 2 AM es la jornada
anterior).

## 2026-09-20 — Cobros y ventas atómicos vía RPC `SECURITY DEFINER`, revirtiendo la decisión de "toda la lógica en Server Actions"
Elegido: tres funciones de Postgres (`complete_walkin_and_charge`,
`complete_appointment_and_charge`, `sell_product_and_charge`) que hacen
todas las escrituras de un cobro dentro de una única transacción.
Descartado: seguir con dos o tres llamadas sueltas desde el Server Action y
compensar a mano cuando la segunda falla.
Por qué: la decisión vigente desde la spec 05 era mantener la lógica en
Server Actions y no en RPC/triggers, para que se lea en un solo lugar. Eso
sirvió hasta que el costo del atajo se volvió concreto: un corte guardado
sin cobrar, o stock descontado sin venta, dejan la caja mal y **no hay
compensación automática** — el mensaje "avisá para revisar el desfase" le
pasaba el problema al barbero. Un cuerpo de función plpgsql ya corre dentro
de una transacción, así que cualquier `raise` revierte todo lo anterior: es
la única forma de que "el corte se guardó pero no entró a la caja" deje de
ser un estado posible. El `for update` del RPC de venta además reemplaza al
update condicionado al stock leído (decisión del 2026-09-16) con un lock
real, y el del turno agendado hace lo mismo con el `eq("status",
"scheduled")` contra el doble cobro.
Costo: la lógica de tres cobros se parte en dos lugares (el Server Action
traduce, la función decide) y las funciones son SECURITY DEFINER, así que
saltean RLS y tienen que revalidar a mano lo que las policies garantizaban
—caja propia y abierta, servicio/producto del mismo tenant—. Si alguien
agrega una policy nueva y se olvida de mirar estas funciones, no se entera.
El comentario de cabecera de la migración enumera qué revalida cada una.

## 2026-09-20 — El monto lo lee el RPC, no viaja como parámetro
Elegido: las funciones reciben `service_id` / `product_id` y leen
`services.price` / `products.price` adentro de la misma transacción.
Descartado: la firma que proponía la spec 09 (`amount` como parámetro,
leído antes por el Server Action).
Por qué: pasarlo como parámetro seguiría siendo seguro —el Server Action
corre en el servidor— pero abre una ventana entre leer el precio y cobrarlo,
y deja un parámetro `amount` en una función expuesta a `authenticated`, que
es exactamente la forma del agujero que documenta `docs/aprendizajes-v1.md`
("cualquier usuario puede alterar las peticiones HTTP y manipular la caja").
Leerlo adentro hace que no exista camino por donde un monto entre desde
afuera.
Costo: la firma se aparta de la letra de la spec. Consultado y confirmado
antes de implementar.

## 2026-09-20 — La zona horaria no entra al SQL: el fin del día viaja como instante
Elegido: `complete_appointment_and_charge` recibe `p_max_start_time`, que el
Server Action calcula con `businessDayRangeUtc(businessToday())`.
Descartado: resolver `(start_time at time zone 'America/Asuncion')::date`
dentro de la función.
Por qué: `src/lib/dates.ts` es la única fuente de verdad de "qué día es" en
la app (CLAUDE.md). Meter la zona también en el SQL la duplica en un lugar
donde nadie la va a buscar el día que haya que cambiarla — y ya está anotado
en deuda técnica que si se suma otro país hay que pasarla a una columna de
`barbershops`.
Costo: un parámetro menos obvio de leer en la función; queda explicado en el
comentario.

## 2026-09-20 — `users`: grants por columna + RPC del dueño + `service_role` para la racha
Elegido: tres capas. (1) Policy `users_update_own`: cada uno sólo toca su
fila. (2) `revoke update` + `grant update (name)`: un barbero no puede
escribir `streak_count`, `level` ni `commission_pct` ni siquiera en su propia
fila. (3) Lo que sí tiene que escribirse va por caminos con privilegio
propio: el dueño editando a su equipo por `update_team_member` (SECURITY
DEFINER, valida el rol), y la racha/nivel por `createAdminClient()`
(`service_role`).
Descartado: (a) sólo cambiar la policy, que es lo que la spec 09 pedía
literalmente; (b) un trigger `BEFORE UPDATE` que compare OLD/NEW según el
rol.
Por qué: una policy de RLS no puede mirar **qué columna** cambió —no tiene
OLD/NEW—, así que "sólo podés editar campos no sensibles de tu perfil" no se
puede expresar como policy. Los grants por columna sí: Postgres rechaza el
update antes incluso de evaluar la policy. El trigger también servía, pero
esconde la regla en un lugar donde no se la busca; un RPC con nombre propio
se lee desde el Server Action que lo llama.
Costo: la spec pedía restringir el update "a campos no sensibles del propio
perfil", lo que a secas rompía `/equipo` (el dueño edita nivel y comisión de
sus barberos). Se consultó y se confirmó este diseño. Además, cerrar
`authenticated` obliga a que el cierre de caja dependa de
`SUPABASE_SERVICE_ROLE_KEY`: `applyStreakAndLevel` quedó envuelto en
try/catch para que, si falta la key, el cierre igual se reporte como exitoso
(la caja ya está cerrada y con el saldo correcto en la base) — la regla del
2026-09-17 sigue valiendo.

## 2026-09-20 — `transactions.category` en vez de deducir el tipo del texto de la descripción
Elegido: una columna `category` (`service` / `product` / `manual`) con
`check`, escrita por los tres RPC y por el movimiento manual.
Descartado: seguir distinguiendo por el prefijo de `description`
("Corte: ", "Venta: ").
Por qué: el ticket promedio del dueño dividía **todo** lo cobrado por la
cantidad de cortes, así que una barbería que vende cera mostraba un ticket
que ningún cliente pagó nunca. Un prefijo de texto no es un dato: se rompe
con cambiar una palabra de la copia.
Costo: una migración de esquema y una columna más para mantener. Las filas
que ya existían se backfillean por ese mismo prefijo —el criterio que
usábamos a ojo hasta ahora—, así que una descripción rara de antes del
2026-09-20 puede quedar clasificada como `manual`. El `default 'service'` de
la columna sólo cubre a un insert que se olvide de pasarla; ningún camino
del código depende de él.

## 2026-09-20 — En Supabase, `revoke execute from public` no deja afuera a `anon`
Elegido: revocar `execute` explícitamente a `anon` en cada función nueva
(`20260920030000_revoke_rpc_from_anon.sql`), además del revoke sobre PUBLIC.
Descartado: dar por bueno el `revoke ... from public` + `grant ... to
authenticated`, que es el patrón que uno esperaría.
Por qué: Supabase configura `alter default privileges ... grant execute on
functions to anon, authenticated, service_role`, así que cada función nace
con un grant **explícito** a `anon`. Un revoke sobre PUBLIC no toca un grant
explícito a un rol: son dos cosas distintas. Se descubrió verificando contra
el proyecto real — `proacl` mostraba `anon=X/postgres`, y un POST a
`/rest/v1/rpc/complete_walkin_and_charge` con la anon key entraba al cuerpo
de la función en vez de rebotar. No había fuga de datos (las cinco funciones
cortan con CL008 apenas ven `current_user_id()` en null, que es justamente
por qué son SECURITY DEFINER), pero una función SECURITY DEFINER ejecutable
por cualquiera con la clave pública es superficie de ataque que no hace falta
tener.
Costo: hay que acordarse de revocarle a `anon` en cada función nueva; el
revoke sobre PUBLIC solo es engañoso porque *parece* suficiente. Vale como
regla general del repo, no como detalle de esta migración.

## 2026-09-20 — `randomId()` en vez de `crypto.randomUUID()` en el cliente
Elegido: `src/lib/ids.ts`, que usa `crypto.randomUUID()` cuando existe y si no
arma el UUID v4 con `crypto.getRandomValues`.
Descartado: llamar a `crypto.randomUUID()` directo, como hacía el
`timerStore` desde la spec 05.
Por qué: `crypto.randomUUID()` **sólo existe en contextos seguros** (HTTPS o
`localhost`). Servida por IP con HTTP plano —que es exactamente cómo se prueba
la app desde un celular en la misma red, y el caso de uso principal de una app
mobile-first— queda `undefined`, y `startTimer` moría con
`TypeError: crypto.randomUUID is not a function` **antes** de crear nada: el
barbero tocaba "Iniciar corte" y no pasaba absolutamente nada, sin mensaje de
error. Lo encontró el usuario probando desde su celular el 2026-09-20; en
desarrollo no aparecía nunca porque `localhost` sí cuenta como contexto
seguro. `crypto.getRandomValues` no tiene esa restricción y da la misma
calidad de aleatoriedad.
Costo: una indirección más y un UUID armado a mano. A cambio, la app deja de
depender de que el origen sea seguro para una función que no tiene nada que
ver con seguridad.
Nota para el futuro: `navigator.clipboard` (copiar la contraseña temporal en
`/equipo`) tiene la misma restricción, pero ya estaba envuelto en try/catch y
la contraseña se ve en pantalla igual, así que degrada solo. Cualquier API
nueva que se agregue conviene mirarla con esta lupa: probar por IP desde el
celular es parte del flujo normal de este proyecto.

## 2026-09-20 — Dirección visual: bento UI (grilla de cubos)
Elegido (a pedido del usuario, con mockups iterados en el canvas
"Muestrario Clippr" antes de tocar código): las pantallas de `/inicio`,
`/caja` y `/estadisticas` pasan a una grilla de cubos (`Tile`), donde la
jerarquía la da el **tamaño** del cubo y **un solo cubo relleno** por
pantalla. Se agrega `src/components/ui/Tile.tsx` (`Tile`, `StatTile`,
`tileClasses`) y el token `--radius-tile`; `StatCard` de la spec 08 queda
absorbido por `StatTile`.
Descartado: glassmorphism (vidrio sobre fondo de color), explorado en los
artboards L a O del mismo canvas.
Por qué: el bento reusa los tokens que ya había y no necesita ninguna
librería, así que el costo es de layout y no de sistema. El vidrio exige un
fondo de color detrás (o no se ve nada), lo que choca con la identidad
clara, y `backdrop-filter` repinta en cada scroll: caro justo en el
teléfono de gama media que es el dispositivo objetivo.
Costo: cuatro pantallas con su propia grilla que hay que mantener
coherentes — el radio y el relleno se cambian desde `--radius-tile` y
`Tile`, pero la elección de qué entra en cada grilla es manual. `/agenda`,
`/servicios`, `/productos` y `/equipo` **no** se pasaron a bento en esta
tanda, así que por un rato conviven dos lenguajes de layout.

## 2026-09-20 — Modo oscuro con switch: supera la decisión del 2026-09-14
Elegido (a pedido del usuario): dos temas conmutados por `data-theme` en el
`<html>`, con un switch en `/mas`. El tema se guarda en la cookie
`clippr-theme` y lo lee el **servidor** en `src/app/layout.tsx`, que baja el
HTML ya pintado.
Descartado: `prefers-color-scheme` (seguir al sistema operativo);
`localStorage` + script inline; un Server Action para guardar la
preferencia.
Por qué: esto **reemplaza** la decisión "Fondo blanco fijo — no hay modo
oscuro por ahora" del 2026-09-14 (más arriba en este archivo), que queda
superada; el usuario pidió el modo oscuro explícitamente el 2026-09-20.
Sobre el mecanismo: con la cookie el servidor ya sabe el tema al renderizar,
así que no hay parpadeo de claro a oscuro en el primer pintado ni desajuste
de hidratación — que es justo lo que pasa con `localStorage`, que sólo se
puede leer en el cliente. Y no es un Server Action porque cambiar de tema
tiene que funcionar con la red caída (regla 4 de CLAUDE.md) y no hay nada
que revalidar: el `ThemeSwitch` escribe `document.documentElement.dataset.theme`
y la cookie desde el cliente. Una preferencia visual no es lógica de negocio
sensible, así que no cae bajo la regla 1.
El acento oscuro se mantiene en la familia Tinta (`#3d6da8`), no en el
dorado que mostraba el mockup: cambiar de color de marca al invertir el tema
son dos identidades, no una.
Costo: leer la cookie vuelve dinámica la raíz (ya lo era de hecho por las
cookies de sesión de Supabase). Cada pantalla nueva hay que mirarla en los
dos temas, y el contraste de los cubos rellenos se verifica a mano. `dark:`
quedó reapuntado a `data-theme` con `@custom-variant` para que nadie lo use
creyendo que sigue al switch cuando en realidad seguiría al sistema.

## 2026-09-20 — `--accent` se parte en tres tokens
Elegido: `--accent` (relleno), `--accent-contrast` (texto **sobre** el
relleno) y `--accent-ink` (el acento usado **como** texto o ícono sobre el
fondo). Se suma `--success`, que antes no existía.
Descartado: un solo `--accent` con `text-white` a mano encima, que es lo que
había.
Por qué: el mismo color se usaba para las dos cosas — `bg-accent` con texto
blanco en `Button`, y `text-accent` en `BottomNav` y en los precios de las
listas. Al invertir el tema eso es imposible de cumplir con un valor: el
azul que contrasta sobre blanco no contrasta sobre carbón. `--success` entró
porque los cubos de caja distinguen ingresos de egresos por color y el verde
estaba hardcodeado en el mockup.
Costo: tres tokens en vez de uno, y hay que saber cuál va en cada caso. La
regla es simple: si el color pinta un fondo es `accent`; si pinta texto
sobre el fondo de la página es `accent-ink`.

## 2026-09-20 — La caja sale de `/inicio`; el nivel se queda en `/estadisticas`
Elegido (a pedido del usuario): `/inicio` muestra racha y cortes del día
(dos cubos, arriba), el cubo relleno de "Iniciar corte" y los turnos
agendados de hoy. Sin saldo de caja y sin barra de nivel.
Descartado: el cubo de caja y el de nivel en `/inicio`, que estaban en el
mockup H.
Por qué: `/inicio` tiene una sola acción que empujar (arrancar un corte) y
el saldo competía con ella teniendo su propia pantalla en la BottomNav. El
nivel necesita explicar que se mide sobre una ventana móvil de 30 días, y
ese espacio sólo existe en `/estadisticas` — un "Nivel Pro" suelto no se
entiende. `/inicio` sigue pidiendo la caja al servidor aunque no la muestre:
`TimerList` necesita el `cashSessionId` para poder cobrar.
Costo: para ver el saldo hay un toque más. Los turnos de `/inicio` son sólo
lectura (cobrar y cancelar siguen en `/agenda`, que es la que tiene el
estado optimista), así que el mismo dato se muestra en dos lugares con
capacidades distintas.

## 2026-09-20 — Los formateadores de fecha se centralizan en `src/lib/dates.ts`
Elegido: `formatBusinessDateLabel`, `formatBusinessTime` y
`formatBusinessDateTime` viven en `dates.ts`, junto al resto de las fechas
del negocio.
Descartado: dejar que cada pantalla armara su `Intl.DateTimeFormat` con la
zona puesta a mano, que es lo que había (uno en `AgendaView`, otro en
`AppointmentRow`, otro inline en `caja/page.tsx`).
Por qué: la regla del repo es que "qué día es" y "a qué hora" se resuelven
en un solo lugar; tener tres copias es exactamente cómo se cuela un
`timeZone` olvidado. `/inicio` necesitaba los mismos formatos y era el
momento de unificar.
Costo: ninguno de fondo, pero quedó algo a la vista: **`es-PY` formatea la
hora en 12 horas** ("3:30 p. m.", no "15:30"), que es lo que la app viene
mostrando desde la spec 06. Se dejó igual para no cambiar un
comportamiento que nadie pidió cambiar; si se prefiere 24 horas es agregar
`hourCycle: "h23"` al formateador, y cambia en las tres pantallas a la vez.
Anotado también que Paraguay dejó de mover el reloj en 2024 y quedó fijo en
UTC−3, así que ya no hay que pensar en qué mes es para calcular el offset.

## 2026-09-20 — El temporizador se vincula al turno agendado, no lo duplica
Elegido: `Timer` gana `appointmentId` y `serviceId` opcionales
(`src/store/timerStore.ts`). Desde `/inicio`, "Empezar" arranca un
temporizador atado al turno, y al finalizar cobra con
`completeScheduledAppointmentAction` — el RPC
`complete_appointment_and_charge` que ya existía desde la spec 09, sin
tocarlo.
Descartado: usar el temporizador de walk-in para un cliente con turno (lo
único posible hasta hoy), que crea un `appointment` nuevo y deja el
agendado colgado para cancelarlo a mano; y poner "Cobrar" en `/inicio`
sin cronómetro.
Por qué: había un hueco de modelo, no sólo de UI. El temporizador existía
sólo para el cliente de paso, así que un cliente **con** turno que llegaba y
se sentaba no tenía reloj. El pedido del usuario ("no puedo empezar desde
ahí, me tengo que ir a agenda") es el síntoma. Sin `appointmentId` el timer
sigue siendo un walk-in exactamente como antes, así que los timers que ya
estaban en `localStorage` no necesitan ninguna migración de estado.
Costo: dos formularios de cierre en vez de uno (`FinishWalkinForm` y
`FinishAppointmentForm`, con el aviso de caja cerrada extraído a
`SinCajaAviso`). Y el turno queda registrado con la hora **agendada**, no
con la del cronómetro: si el cliente de las 15:30 llega 15:45, el timer
marca 30 min y el turno guarda 45. Cambiarlo pide un parámetro nuevo en el
RPC y una columna `scheduled_start_time` para no perder la hora original
(ver docs/deuda-tecnica.md).

## 2026-09-20 — Al empezar un turno, la fila desaparece de "Lo que viene"
Elegido (a pedido del usuario): el turno que ya tiene temporizador se
filtra de la lista de `/inicio`. Con todos en curso, el cubo dice "Todos
los turnos de hoy están en curso" y no "No tenés turnos agendados", que
sería falso.
Descartado: dejar la fila en gris marcada "En curso".
Por qué: el turno se **mudó** de una lista a la otra; mostrarlo en las dos
hace aparecer al mismo cliente dos veces en la misma pantalla, con dos
juegos de acciones distintos. Consecuencia técnica: `UpcomingAppointments`
pasó de Server Component a client component, porque el filtro depende del
store del temporizador. Los datos siguen bajando por props desde el
servidor — ahí no se decide nada, sólo se dibuja.
Costo: un client component más en el árbol de `/inicio`, y el detalle de
hidratación de la entrada siguiente.

## 2026-09-20 — `useTimerStore.persist` no existe en el servidor
Elegido: los tres accesos a `.persist` en `useTimerStoreHydrated` van con
`?.`, y el hook arranca en `false` cuando no hay API de persistencia.
Descartado: leer `useTimerStore.persist.hasHydrated()` directo en el
inicializador de `useState`, que es lo que escribí primero.
Por qué: **tumbó `/inicio` con un 500.** Cuando no hay `localStorage`, el
middleware `persist` de Zustand avisa por consola y devuelve el store
pelado, **sin colgarle la API de persistencia**. El código original sólo
tocaba `.persist` dentro de un `useEffect`, que corre nada más que en el
cliente, así que nunca se había notado; moverlo al inicializador de
`useState` lo puso en el camino del **render**, y el render de un client
component también pasa por el servidor. `TypeError: Cannot read properties
of undefined (reading 'hasHydrated')` en el log del dev server, con el
stack `useTimerStoreHydrated` → `TimerList` → `GET /inicio 500`.
Por qué el inicializador y no `false` a secas: en un mount posterior (ir de
/caja a /inicio sin recargar) el store ya está hidratado, y arrancar en
`false` mostraría un parpadeo de la lista sin filtrar. Con el `?.` se
conservan las dos cosas.
Costo: tres `?.` y una función `persistApi()` de una línea. Regla general,
hermana de la de `crypto.randomUUID` (más arriba): antes de mover código de
un `useEffect` al cuerpo del render, preguntarse si eso existe en el
servidor. Hay un test que fija el contrato en `timerStore.test.ts`.

## 2026-09-20 — Descartar el temporizador ante cualquier error, no según el texto del mensaje
Elegido: si el cobro de un turno falla, `FinishAppointmentForm` muestra el
error y ofrece **Descartar** y **Reintentar**, sin importar cuál fue el
error.
Descartado: comparar el mensaje con `"Turno no encontrado o ya fue
actualizado."` para ofrecer Descartar sólo en ese caso.
Por qué: el caso que hay que cubrir es el turno que se cobró o se canceló
desde `/agenda` mientras el temporizador corría — el RPC devuelve `CL004` y
el turno ya no está en `scheduled`, así que el barbero se quedaba con un
temporizador imposible de cerrar. Pero decidirlo mirando el texto se rompe
en silencio el día que alguien reescribe la copia, y las constantes de
mensaje no se pueden exportar desde un archivo `"use server"` (Next exige
que todo lo exportado ahí sea una función async). Y descartar **no pierde
plata**: si el turno sigue agendado se cobra desde `/agenda`.
Costo: el barbero puede descartar un temporizador tras un error de red y
perder el cronómetro (no el cobro). A cambio, nunca queda trabado.

## 2026-10-03 — Hosting en Cloudflare Workers (OpenNext), no en Vercel
Elegido: Cloudflare Workers con el adaptador `@opennextjs/cloudflare`
(`wrangler.jsonc`, `open-next.config.ts`, `npm run deploy`). Para probar se
arranca en el plan gratis; para operar con clientes que pagan, el plan de
US$5/mes.
Descartado: Vercel. El plan Hobby prohíbe el uso comercial (un SaaS como
Clippr lo es) y el Pro cuesta US$20 por usuario por mes, contra US$5 de
Cloudflare con uso comercial permitido.
Por qué: presupuesto (`docs/producto.md`). La app no tiene nada que choque
con Workers: sin `middleware.ts`, sin `runtime = "edge"`, sin `next/image`,
y lo único de Node es `node:crypto` (`passwords.ts`), que anda con
`nodejs_compat`. Sin caché incremental en R2: todas las pantallas son
dinámicas (leen la cookie de sesión).
Costo: el plan gratis corta cada pedido a los **10 ms de CPU**, y no se
sabe todavía si las pantallas de Next entran ahí — `observability` está
prendido en `wrangler.jsonc` para medirlo en el dashboard antes de decidir
el plan. El límite de 100.000 pedidos por día es **por cuenta**, no por
Worker: se comparte con cualquier otro proyecto de la misma cuenta. Además
`next build` corre igual que antes, pero lo que se sube es el bundle de
OpenNext (`.open-next/`), que es otra capa que puede fallar distinto que
`next start`. Las variables `NEXT_PUBLIC_*` se incrustan al compilar (salen
de `.env.local`); `SUPABASE_SERVICE_ROLE_KEY` va como secreto del Worker
(`wrangler secret put`), y en local en `.dev.vars` (ignorado por git).

## 2026-10-03 — Campos de formulario con etiqueta flotante
Elegido: `Input` y el nuevo `Select` (`src/components/ui/`) con etiqueta
flotante: caja de 58 px, borde `--line-strong` (token nuevo, en los dos
temas), radio de 14 px y, al escribir, borde `accent-ink` con halo. El
nombre del campo vive adentro y sube achicado cuando hay valor o foco.
`Input` acepta `prefix` ("Gs." en el monto de caja). Los tres `<select>`
sueltos (agenda, venta, nivel del barbero) y los campos escritos a mano de
login, registro y monto de caja pasaron a estos componentes.
Descartado: contorno simple, relleno, etiqueta adentro tipo cubo y línea
inferior (las cinco opciones del muestrario "Campos de Clippr", Artifact
del 2026-10-03). El usuario eligió la flotante.
Por qué: los campos de antes medían 40 px (incómodos para el pulgar), casi
sin redondeo frente a los 20 px de los cubos y sin foco visible de marca.
La flotante es compacta (el nombre no ocupa una línea aparte).
Costo: depende de `:placeholder-shown`, así que todo `Input` lleva un
placeholder (un espacio si no se pasa uno); los ejemplos tipo "Ej. Juan
Pérez" quedan invisibles hasta tocar el campo. El orden de los variantes de
Tailwind importa (`peer-placeholder-shown` antes que `peer-autofill` y
`peer-focus`, verificado en el CSS compilado). El monto grande de abrir caja
(`OpenCashView`) no cambia: es un caso aparte, a propósito.

## 2026-10-03 — La racha es un poste de barbería y rompe el minimalismo
Elegido: el poste de barbería (`BarberPole`) como forma visual de la racha
en /inicio, /estadisticas y el cierre de caja, con tres estados (gira,
frenado, gris) y tres niveles (acero, oro, encendido). Es la única pieza de
la app con colores propios (rojo, blanco y el azul tinta) y movimiento
continuo.
Descartado: llama viva, contador con chispas, semana encendida, pantalla de
hito con confeti y llama que se apaga (las otras cinco del Artifact
"Animaciones de la racha"). El usuario eligió el poste "completamente" y
pidió que la racha rompa la regla del minimalismo.
Por qué: es de barbería, ninguna otra app lo tiene, y usa el color de la
marca. Que el poste se *frene* en el día de gracia explica sin texto la
regla que hasta ahora nadie entendía.
Costo: una animación que no para en /inicio (chica, 12 px de ancho, y quieta
con "reducir movimiento"). El estado de la racha se deriva en cada carga
de /inicio y /estadisticas con dos consultas más (últimas cajas cerradas y
sus cobros) en vez de guardarse; a cambio, un barbero que dejó de cerrar
caja ve 0 y no su número viejo. Los niveles del poste (7 y 30 días) están
en `src/lib/streaks.ts`, como los de la liga en `levels.ts`: son reglas de
juego, no precios (regla 6).

## 2026-10-03 — La hoja del poste vive en el layout, con un store
Elegido: `StreakCelebration` montada en `(dashboard)/layout.tsx`, alimentada
por un store de Zustand (`useStreakCelebration`) que llena
`CloseCashButton` cuando `closeCashSessionAction` devuelve que la racha
subió.
Descartado: estado local en `CloseCashButton`, y pasar el festejo por la URL
(`/caja?racha=12-13`).
Por qué: apenas se cierra la caja, la revalidación vuelve a renderizar /caja
como "Abrir caja" y el botón se desmonta; con estado local la hoja
desaparecería en el mismo instante. La URL dejaría que cualquiera se
"festeje" una racha falsa escribiéndola a mano, y quedaría en el historial.
Costo: un store más (sin `persist`: el festejo no sobrevive un F5, a
propósito) y que `closeCashSessionAction` cambie de forma: ahora devuelve
`{ session, streak }` en vez de la caja sola.

## 2026-10-03 — Paleta papel/tinta/sello: reemplaza el blanco frío y el oscuro azul
Elegido (spec 10, fase 1): los tokens de `globals.css` cambian de valor a
la paleta del recibo: papel `#fffdf6` y cubos `#f4efe4` en claro; carbón
cálido `#161412` y `#211e1a` en oscuro; tinta negra cálida para el texto.
La tinta azul de marca (`--accent`) no cambia. Se suman `--stamp` (rojo de
sello) y `--paper`/`--paper-ink`/`--paper-rule` (el ticket). Los nombres no
cambian, así que ningún componente se tocó por el color.
Descartado: neón, espuma, navaja, damero y libreta (muestrario del
2026-10-03), y cualquier textura de papel (ruido, granulado, imágenes).
Por qué: reemplaza los valores del 2026-09-20 (blanco `#ffffff` y oscuro
azul noche `#0f141b`), que no tenían relación con nada de barbería. Los
tres colores salen del poste, que ya era la pieza con más identidad de la
app. El papel se logra con color, punteado y tipografía, sin texturas, por
el mismo motivo que se descartó el glassmorphism (gama media).
**La regla del rojo:** `--stamp` es sólo tinta de sello y marca algo que ya
pasó (cobrado, agotado, la racha, el mejor del mes). Nunca un botón ni un
error: los errores siguen con `--danger`, aunque los dos sean rojos.
Costo: el contraste se verifica con un test que lee el CSS
(`src/app/__tests__/theme-tokens.test.ts`), no a ojo. `--warning` en claro
quedó "sin cambio" por la spec y no llega a AA sobre los cubos (3,7:1); ver
`docs/deuda-tecnica.md`.

## 2026-10-03 — "Iniciar corte" relleno: revierte el contorno del 2026-09-15
Elegido: el CTA de `/inicio` es el cubo relleno (`bg-accent`) de la
pantalla.
Descartado: el contorno (borde 1,5 px en Tinta, fondo blanco) elegido el
2026-09-15.
Por qué: en los hechos ya era relleno desde el pase a bento (2026-09-20),
pero ninguna entrada de este archivo lo registraba y la del 2026-09-15
seguía diciendo "contorno". Con la regla del bento (un solo cubo relleno
por pantalla), el CTA es el candidato natural, y sobre papel cálido el
contorno se pierde.
Costo: ninguno nuevo; queda escrito.

## 2026-10-03 — Montos y horas en IBM Plex Mono, y en 24 horas
Elegido: `font-mono tabular-nums` (IBM Plex Mono 500/600, la que mejor se
lee al sol) sólo en montos y horas; títulos, nombres, cantidades y fechas
en palabras siguen en Inter. Tres ajustes que salieron de mirarlo a 360 px:
- Los montos grandes bajaron a 2 rem (`/caja`, ingresos del dueño): en mono
  cada cifra ocupa ~0,6 em y "Gs. 10.250.000" a 2,5 rem no entra.
- `StatTile` con `mono` cambia el espacio duro (U+00A0) que pone `Intl`
  entre "Gs." y el número por uno normal, así "Gs." baja de renglón en vez
  de desbordar el cubo de media pantalla.
- `formatBusinessTime`/`formatBusinessDateTime` fijan `hourCycle: "h23"`.
  `es-PY` las da en 12 horas ("04:30 p. m."), que es lo que la app mostraba
  desde la spec 06 (sabido: lo anotaba un test). El muestrario va en 24 h y
  en mono el sufijo rompe la columna de horas. Los tests comparan exacto.
  Cierra lo que quedó abierto el 2026-09-20 ("Los formateadores de fecha
  se centralizan…") y la entrada de `docs/deuda-tecnica.md`, que se borró.
Descartado: mono en el monto grande de abrir caja (`OpenCashView`), cuyo
tamaño está calibrado por cantidad de caracteres para Inter: en mono los
puntos de miles ocupan un ancho entero y "1.000.000" desbordaría. Ya era un
caso aparte desde los campos flotantes.
Por qué: los números en columna se comparan de un vistazo, y es lo que
dice "ticket" sin dibujar ningún ticket.
Costo: una fuente más en todas las pantallas (dos pesos, sólo latin). La
de la Fase 2 (Courier Prime) va a cargarse sólo en el ticket.

## 2026-10-03 — El ticket del cierre sale siempre y lo arma el servidor
Elegido (spec 10, fase 2): al cerrar la caja se imprime un ticket con el
resumen del día en **todo** cierre exitoso, no sólo cuando sube la racha. El
resumen (`summary`) lo calcula `closeCashSessionAction` con `summarizeCash`,
la misma función que da el saldo de `/caja` y el `final_balance`. El sello
de la racha va sólo si la racha se guardó.
Descartado: mostrarlo sólo cuando sube la racha (como la hoja del poste que
reemplaza), y armar el resumen en el cliente sumando los movimientos.
Por qué: el ticket es el resumen del día, que sirve aunque la racha no haya
cambiado (segunda caja del día, o sin la clave de servicio). Calcularlo en
el servidor es la regla 1 de CLAUDE.md, y sacarlo de la misma función que
el saldo hace imposible que el TOTAL impreso difiera del guardado.
Costo: `computeBalance` pasó a `computeSummary` y lee también `category`;
`closeCashSessionAction` hace una consulta más (el nombre del barbero, que
si falla no tumba el cierre). "Compartir" no está todavía: un botón que no
lleva a ningún lado es peor que ninguno, y la pantalla de compartir es de
la fase 3.

## 2026-10-03 — El sello cae sólo sobre lo que acaba de pasar
Elegido: `<Stamp />` decide si anima **una sola vez, al montar**. En
`/agenda`, la fila recuerda con qué estado se cargó: si venía cobrada, el
sello aparece quieto; si se cobra en pantalla, cae.
Descartado: animar en cada render, y animar todos los sellos al cargar la
pantalla.
Por qué: la spec pide el golpe "sólo al aparecer". Siete sellos cayendo a la
vez al abrir la agenda no comunican nada: el golpe tiene sentido para lo que
el barbero acaba de hacer.
Costo: la fila guarda su estado inicial en un `useState`; si una fila
cobrada se desmonta y vuelve a montar (otro día y volver), su sello aparece
quieto, que es lo correcto.

## 2026-10-03 — El mail del equipo, sólo para el dueño
Elegido: `/equipo` muestra "Nivel · mail" (spec 10) leyendo el mail de
`auth.users` con la clave de servicio (`getTeamEmailsAction`), **sólo si
quien mira es el dueño**. La acción no recibe argumentos: lee el equipo
con RLS y valida el rol ella misma.
Descartado: agregar una columna `email` a `public.users` (duplicaría el
dato y obligaría a mantenerlo sincronizado), y mostrarle los mails a
cualquier miembro.
Por qué: el email ya existe en Auth y el dueño es quien da de alta a los
barberos con ese mail. Un barbero no necesita los mails de sus compañeros.
Un Server Action se puede llamar con cualquier argumento, por eso no
acepta una lista de usuarios desde el cliente.
Costo: una llamada a Auth por miembro cada vez que el dueño abre `/equipo`
(equipos chicos). Sin `SUPABASE_SERVICE_ROLE_KEY`, el subtítulo muestra
sólo el nivel.

## 2026-10-03 — En la agenda, "Cobrar" deja de ser un botón relleno
Elegido: "Cancelar" (texto gris) y "Cobrar" (píldora con borde) chicos, en
el segundo renglón de la fila, como el muestrario. "Cancelar" deja de ir en
rojo.
Descartado: mantener "Cobrar" relleno y "Cancelar" en `text-danger`.
Por qué: con varios turnos, un botón relleno por fila rompe la regla de un
solo elemento gritón por pantalla. Y el rojo es sólo del sello y de los
errores (regla 2 de la spec 10); cancelar un turno no es ninguna de las dos.
Costo: "Cobrar" pesa menos visualmente; la acción sigue en el mismo lugar.
Por la misma regla, en el ticket de `/caja` los egresos van en tinta normal
y no en `--danger`.


## 2026-10-04 — "Caja cerrada" en /inicio es un cubo, no un sello ni un error
Elegido: sin caja abierta, `/inicio` muestra un cubo monocromo que es un
link a `/caja` (ícono de billetera, "Tu caja está cerrada", "Abrila para
poder cobrar los cortes." y "Abrir ›" en `--accent-ink`). Reemplaza al
párrafo en `text-danger` con `role="alert"`.
Descartado: dejarlo como texto rojo, y hacerlo un `<Stamp />` (lo propuso
el usuario para que fuera más vistoso).
Por qué: la caja cerrada no es un error (empezar un corte no la necesita,
regla 4 de CLAUDE.md), y el sello es sólo para algo que ya pasó (regla 2 de
la spec 10, que además dice "en `/inicio` no hay sello"). Un cubo se ve igual
de claro, y además lleva a donde se resuelve.
Costo: suma un cubo arriba de "Iniciar corte" mientras la caja está cerrada.
El bloqueo al cobrar sin caja (`SinCajaAviso`, en el formulario de cierre)
sigue en `text-danger`, porque ahí sí es un intento de cobro rechazado.

## 2026-10-04 — "Sin señal" no promete guardar
Elegido (spec 10, fase 3, paso A): sin red, el cobro (`/inicio`, `/agenda`)
y el cierre de caja se deshabilitan con "Sin señal · todavía no se cobró" (o
"…no se cerró la caja") en `font-mono`. El estado de red es `useOnline`
(`navigator.onLine` + eventos `online`/`offline`, leído con
`useSyncExternalStore`). Los temporizadores siguen andando (regla 4).
Descartado: "Sin señal · se guarda cuando vuelva", y dejar que el Server
Action falle al tocar.
Por qué: hoy no existe cola offline. Cobrar y cerrar son Server Actions; sin
red fallan. Prometer que se guarda sería mentirle al barbero con plata en la
mano. Y dejar que falle en `/agenda` era peor: el sello optimista caía y la
fila volvía atrás sola.
Costo: con la red caída no se puede cobrar hasta que vuelva. El paso B (cola
de cobros con id del cliente para no cobrar dos veces) es una spec aparte:
ver `docs/deuda-tecnica.md`. `navigator.onLine === true` no garantiza
internet (sólo una interfaz conectada); si la red "está" pero no anda, el
cobro falla como antes, con su mensaje de error.

## 2026-10-04 — El `update` de `barbershops`, sólo para el dueño
Elegido: migración `20261004000000_barbershops_phone_owner_update.sql`
agrega `barbershops.phone` y reemplaza `barbershops_update_own` por
`barbershops_update_owner` (fila propia **y** `current_user_role() =
'owner'`) + `revoke update` y `grant update (name, phone)` a
`authenticated`. Mismo patrón que `users` en la spec 09.
Descartado: dejar la policy abierta y validar el rol sólo en el Server
Action; una policy sola sin grants por columna.
Por qué: la policy de la spec 01 dejaba a **cualquier integrante** (también
un barbero) cambiar `subscription_plan` desde la consola. Una policy no
puede mirar qué columna cambió, así que el plan queda afuera del grant: ni el
dueño se lo puede cambiar, eso llega con la facturación por `service_role`.
Verificado contra la base real con la sesión de un barbero: `phone` y
`name` → 0 filas, `subscription_plan` → 403 `permission denied`.
Costo: cualquier edición futura de otra columna de `barbershops` necesita su
propio `grant update`.

## 2026-10-04 — Los cortes por servicio salen de `appointments`, sin migración
Elegido: "Corte clásico x5" en la imagen de compartir se arma en
`closeCashSessionAction` (`readShareDay`) con los turnos `completed` del
barbero cuyo `end_time` cae en la ventana de la caja, agrupados por
`services.name` (`countCutsByService`).
Descartado: una columna `transactions.appointment_id`/`service_id`
(migración y backfill), y partir la descripción "Corte: X" de la
`transaction`.
Por qué: los dos RPC de cobro ponen `end_time = now()` en la misma
transacción que insertan el cobro, y sólo con la caja abierta: los turnos de
esa ventana son exactamente los cortes cobrados de la caja. La descripción
es texto para mostrar, no un dato para agrupar.
Costo: depende de esa propiedad de los RPC; si algún día se puede completar
un turno sin cobrarlo, o cobrarlo fuera de la caja abierta, hay que pasar a
la columna. `user_id` se filtra a mano (la RLS de `appointments` ya no acota
al dueño, spec 08). Si la consulta falla, `share` es null y el cierre sale
sin "Compartir".

## 2026-10-04 — La imagen del día se arma con `html-to-image` y sólo dos fuentes
Elegido: la imagen 1080×1920 es un componente (`ShareDayImage`) que reusa
`TicketReceipt` y `StreakStamp`; la vista previa es el mismo nodo achicado
con `transform`, y `html-to-image` (cargado con `import()` al tocar
"Compartir imagen") lo convierte en PNG en el teléfono. Se le pasa
`fontEmbedCSS` armado a mano (`share-fonts.ts`): sólo Inter y Courier Prime,
subset latino. Los colores del papel van fijos en la raíz de la imagen
(regla 4). El TOTAL con "Mostrar montos" es `summary.finalBalance`, el
mismo renglón del ticket del cierre (así está en el muestrario).
Descartado: dibujar con `<canvas>` a mano (duplicaría el ticket y sus
fuentes), generar la imagen en el servidor (no anda sin señal), y dejar que
`html-to-image` incruste todas las fuentes de la página (~50 `@font-face`,
~40 archivos).
Por qué: lo que se ve en la vista previa es exactamente lo que se publica, y
el ticket tiene una sola implementación.
Costo: una dependencia nueva (`html-to-image`, MIT, sin dependencias, fuera
del bundle inicial). `html-to-image` espera un `requestAnimationFrame`: con
la pestaña oculta el navegador lo pausa y la imagen no termina hasta volver
(en el navegador automatizado parecía "colgada"; con la app en pantalla no
pasa). El tiempo en un celular de gama media no está medido.

## 2026-10-04 — La vibración es por dispositivo
Elegido: `navigator.vibrate` con un pulso de 30 ms cuando cae COBRADO
(`<Stamp haptic>`, sólo si el sello cae, no si ya venía cobrado) y
`[40,60,40,60,40]` al imprimirse el ticket del cierre (una vez por cierre;
volver de "Compartir" no reimprime ni vibra). Switch "Vibración" en `/mas`,
en `localStorage` (`clippr-vibracion`), prendido por defecto.
Descartado: guardar la preferencia en la base, y sonidos (no se acordaron).
Por qué: depende del teléfono, no de la persona (en iPhone no hay
`navigator.vibrate`: no hace nada y el switch lo avisa).
Costo: la preferencia no viaja entre dispositivos.

## 2026-10-04 — "Cierres de hoy" es un ticket por caja, no por barbero
Elegido (spec 10, fase 4): en `/estadisticas` del dueño, un `TicketReceipt`
por cada **caja** cerrada hoy (por `start_time`, la jornada), en orden de
cierre, con `summarizeCash` y `closeTicketLines`: es exactamente el ticket
que vio el barbero al cerrar. Va siempre con los de hoy, sea cual sea el
rango de arriba.
Descartado: juntar las cajas de un mismo barbero en un solo ticket.
Por qué: la spec dice "un ticket por barbero que cerró", pero un barbero
puede cerrar dos cajas el mismo día (pasó en la prueba del 2026-10-04), y un
ticket que suma dos saldos iniciales no es ningún cierre real: no coincidiría
con ningún `final_balance`.
Costo: un barbero con dos cierres aparece dos veces en la fila.

## 2026-10-04 — El ticket del mes: días 1 a 7 y "COBRADO" con montos
Elegido: `getMonthTicketAction` arma el resumen del mes anterior sólo del 1
al 7 del mes (`MONTH_TICKET_LAST_DAY`) y sólo si hubo algún corte o día
trabajado. Cortes por `start_time` (como la agenda), "más pedido" con
`countCutsByService`, "mejor día" por cantidad de cortes (a igual cantidad,
el primero) y la racha más larga recorriendo los días trabajados con
`nextStreakCount`, la misma función del cierre. Con "Mostrar montos" suma
**COBRADO**: todo lo que entró en el mes (`sumIncome`, cortes + ventas +
manuales). La pantalla de compartir se generalizó (`ShareTicketScreen`) y la
usan el día y el mes.
Descartado: un TOTAL de saldo como en el cierre (un saldo de caja no tiene
sentido para un mes), y mostrar el ticket todo el mes.
Por qué: "primeros días del mes" queda en una semana, lo que tarda en
dejar de ser noticia. El mejor día por cortes y no por plata, porque la
imagen sale sin montos por defecto.
Costo: el dueño (que también corta) no lo ve: `/estadisticas` del dueño
es otro dashboard (la spec lo pone en la vista del barbero).

## 2026-10-04 — Tarjeta de sellos: la racha de cada día se mira 90 días atrás
Elegido: `getStampCardAction` lee las cajas cerradas desde 90 días antes del
1° del mes (`STAMP_CARD_LOOKBACK_DAYS`) y `streakByDay` calcula la racha al
final de cada día trabajado con `nextStreakCount`. Los días en que la racha
llega justo a 7 y a 30 llevan el poste de oro o el encendido (`BarberPole`
achicado a la mitad en la esquina de la celda); los días trabajados, el
número estampado con `<Stamp />` quieto.
Descartado: contar la racha sólo desde el 1° del mes (el día 7 o 30 caería
mal si la racha venía del mes anterior), y leer el historial entero.
Por qué: una racha que viene de septiembre tiene que marcar su día 30 donde
de verdad cae. Con 90 días hacia atrás sólo una racha de más de tres meses
podría marcarlo mal.
Costo: una consulta de hasta ~120 días de cajas por visita a
`/estadisticas` del barbero.

## 2026-10-04 — Las pantallas vacías son un ticket de la app, no papel
Elegido: `<BlankTicket />` usa `--surface-2` con zigzag (como los
movimientos de `/caja`), renglones punteados vacíos y una línea en Courier
Prime. Adentro de un cubo va con `tone="inset"` (fondo de la pantalla), si
no se pierde la forma. En `/caja` sin movimientos, la línea va adentro del
ticket existente. Y los tickets de papel sobre la página (cierres de hoy,
ticket del mes) llevan `drop-shadow`: en claro el papel y el fondo son del
mismo color.
Descartado: papel (`--paper`) para las pantallas vacías.
Por qué: una lista vacía no es un objeto impreso (regla 4); en oscuro un
papel claro por cada pantalla vacía gritaría más que el contenido.
Costo: dos tonos para el mismo componente.
