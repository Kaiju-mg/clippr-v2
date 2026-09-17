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
