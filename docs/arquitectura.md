# Arquitectura de Clippr v2

## Stack Elegido

**Next.js (App Router) + Supabase + Tailwind CSS**, mobile-first y PWA. Elegido e implementado en el scaffolding inicial (2026-09-09).

**¿Por qué este cambio frente a tu idea original (Django + Next.js + Supabase)?**
Como desarrollador solitario ("solo dev"), la simplicidad y la velocidad de desarrollo son tu mayor ventaja.

- **Menos piezas móviles:** Usar Django + Next.js + Supabase implica mantener un backend en Python, un frontend/backend en Node (Next.js) y una base de datos/BaaS. Es demasiada sobrecarga operativa y de despliegue.
- **Un solo lenguaje (TypeScript/JavaScript):** Al usar Next.js para el frontend y el backend (mediante Server Actions o Route Handlers), no tienes que cambiar el contexto mental entre Python y JS constantemente.
- **Supabase lo tiene todo:** Te resuelve la base de datos relacional (PostgreSQL), autenticación, y políticas de seguridad (Row Level Security), eliminando gran parte del trabajo de infraestructura y APIs básicas que harías en Django.
- **Experiencia de App Nativa (PWA):** Next.js y Tailwind CSS son excelentes para diseñar "mobile-first". Configurando tu app como Progressive Web App (PWA) con un `manifest.json` y un Service Worker, los barberos podrán "Instalar" la web en sus celulares o tablets (Android/iOS) accediendo como si fuera una app nativa desde su pantalla de inicio.

### Versiones y herramientas

- **Next.js 15** (App Router) + **React 19** + **TypeScript** en modo `strict`. Se quedó en la 15 y no en la 16, ver `decisiones.md`.
- **Tailwind CSS v4** — configuración vía `@import "tailwindcss"` en `src/app/globals.css`, sin `tailwind.config.js`.
- **Supabase** vía `@supabase/ssr`, con clientes separados: `src/lib/supabase/client.ts` (browser) y `src/lib/supabase/server.ts` (Server Components / Actions / Route Handlers).
- **Zustand** para el estado global del frontend.
- **Tests:** Vitest + Testing Library (ver `decisiones.md`). Se colocan junto al archivo que prueban (`route.ts` → `route.test.ts`).
- **Lint / formato:** ESLint (flat config, presets `next/core-web-vitals` + `next/typescript`) + Prettier. El script es `eslint .`, no `next lint` (deprecado en Next 16).
- Alias de imports: `@/*` → `src/*`.

### Estado de la PWA

`manifest.json` y la metadata en el layout raíz ya están. El **Service Worker** (offline, cache de assets, cola de sincronización) todavía no se implementó.

### Health check

`GET /api/health` responde `{ status, service, timestamp }` sin tocar base de datos ni auth. Sirve para probes de deploy y monitoreo de uptime.

### Auth y Multi-Tenant (implementado)

Primera rebanada vertical (`docs/specs/01-infra-auth-multitenant.md`), probada de punta a punta contra un proyecto Supabase real.

- **Alta de dueño + barbería:** `registerOwnerAction` (`src/actions/auth.actions.ts`) llama a `supabase.auth.signUp()` y, con la sesión ya activa, al RPC `register_owner` (`SECURITY DEFINER`, ver `supabase/migrations/`), que crea `barbershops` y `users` en una sola transacción. Si algo falla no queda un usuario de Auth "fantasma" sin perfil. `loginAction` y `logoutAction` completan el flujo (`logoutAction` redirige a `/login`).
- **RLS:** habilitado en `barbershops` y `users`. Las políticas usan la función `public.current_barbershop_id()` (`SECURITY DEFINER`) en vez de un `EXISTS` directo contra `users`, para evitar recursión de RLS.
- **Migraciones versionadas:** `supabase/migrations/` con el Supabase CLI (`supabase init` + `supabase link`). El proyecto real está linkeado; las credenciales viven en `.env.local` (no versionado).
- **Páginas:** `(auth)/login`, `(auth)/registro` (formularios controlados, sin librería de forms) y `(dashboard)/layout.tsx` (guard de sesión server-side vía `supabase.auth.getUser()`; sin navbar propia desde el 2026-09-15 — ver "Sistema de Diseño"). Tras login/registro exitoso se redirige a `/inicio` (cambiado de `/agenda` en la spec 05 — ver "Flujo de Walk-ins y Temporizador" más abajo y `decisiones.md`).
- **"Confirm email" desactivado** en el proyecto de Supabase por ahora (ver `decisiones.md` — hay que revisarlo antes de tener usuarios reales).

### Catálogo de Servicios (implementado)

Segunda rebanada vertical (`docs/specs/02-catalogo-de-servicios.md`). Las dos
migraciones (`20260914000000_create_services_table.sql` y
`20260914010000_services_price_integer.sql`) ya están aplicadas contra el
proyecto real (`supabase db push`). Probado con Vitest (Supabase mockeado)
**y** de punta a punta en el navegador contra el proyecto real, incluyendo
aislamiento de tenant con dos barberías.

- **CRUD:** `src/actions/service.actions.ts` (`getServicesAction`,
  `createServiceAction`, `updateServiceAction`, `toggleServiceStatusAction`).
  Ninguna filtra por `barbershop_id` a mano: el `INSERT` completa la columna
  solo via `default public.current_barbershop_id()` y el resto delega el
  aislamiento en las políticas RLS de `services`.
- **UI:** `(dashboard)/servicios/page.tsx` (Server Component) +
  `_components/ServiceList.tsx` y `_components/ServiceInlineForm.tsx` (Client
  Components, usan `router.refresh()` tras cada mutación exitosa). Editar
  expande la fila in-place (sin modal); "Nuevo servicio" abre el mismo
  formulario arriba de la lista. Activar/Desactivar es un `Switch`
  (`src/components/ui/Switch.tsx`) con `useOptimistic` — cambia al instante,
  sin esperar al servidor. `getServicesAction` devuelve todos los servicios
  (activos primero); no hay borrado, solo `toggleServiceStatusAction`.
  Componentes base en `src/components/ui/` (`Button`, `Input`, `Switch`).
- **Precio en guaraníes:** `price` es `integer` (sin decimales — el PYG no
  tiene subunidad) y se muestra con `formatGuaranies()` (`src/lib/utils.ts`).
- **Dirección visual (spec 02):** tema claro fijo (sin `prefers-color-scheme`),
  acento "Tinta" (`#1f3a5f`). Tokens en `src/app/globals.css`. Ver
  `decisiones.md` 2026-09-14. Tipografía actualizada el 2026-09-15 — ver
  sección "Sistema de Diseño" más abajo.

### Gestión de Equipo (implementado)

Tercera rebanada vertical (`docs/specs/03-gestion-de-equipo.md`). Sin
migraciones nuevas: la tabla `users` ya traía `level`/`commission_pct` desde
la Spec 01, y la policy `users_insert_same_barbershop` ya permitía el
`INSERT` que necesita esta spec. Probado con Vitest (Supabase mockeado); no
se corrió el flujo de punta a punta contra el proyecto real (crear un
barbero real y loguearse con esa cuenta) en esta sesión.

- **Alta de barberos:** `src/lib/supabase/admin.ts` expone un cliente con la
  `SERVICE_ROLE_KEY`, de uso exclusivo en el servidor y solo para
  `auth.admin.createUser()` — así se crea la cuenta de Auth del barbero sin
  cerrar la sesión del dueño (que es lo que pasaría con `auth.signUp()`).
  `createBarberAction` (`src/actions/team.actions.ts`) hace ese alta y
  después inserta el perfil en `public.users` con el cliente normal (sesión
  del dueño, con RLS), heredando `barbershop_id` del propio perfil del
  dueño — nunca del payload que manda el cliente.
- **RBAC en el Server Action, no en RLS:** `createBarberAction` y
  `updateBarberAction` verifican explícitamente `role === 'owner'` de quien
  llama antes de hacer nada. RLS solo aísla tenants (Barbería A de B); un
  barbero autenticado técnicamente podría intentar un `insert`/`update`
  directo contra `users` de su propia barbería si evita el Server Action —
  eso es lo que valida el control de rol en la acción. Ver
  `docs/specs/03-gestion-de-equipo.md` sección 5 y `decisiones.md`.
- **UI:** `(dashboard)/equipo/page.tsx` (Server Component) +
  `_components/TeamList.tsx` y `_components/BarberInlineForm.tsx` (Client
  Components). Mismo patrón de fila expandible que `servicios` (sin modal ni
  bottom sheet, pese a que la spec 03 lo sugería — ver `decisiones.md`
  2026-09-14). El botón "Agregar Barbero" y el ícono de editar solo se
  muestran si `isOwner`; la fila del dueño se lista pero no es editable
  desde acá.

### Sesión de Caja Diaria (implementado)

Cuarta rebanada vertical (`docs/specs/04-sesion-de-caja-diaria.md`).
Migraciones: `20260915000000_create_cash_sessions_table.sql` (tabla
`cash_sessions` + función `current_user_id()`) y
`20260915010000_cash_sessions_select_own_only.sql` (corrige el `SELECT`,
ver `decisiones.md`), ambas aplicadas contra el proyecto real
(`supabase db push`). Probado con Vitest (Supabase mockeado) **y** de
punta a punta en el navegador/scripts contra el proyecto real: apertura y
cierre, bloqueo de doble caja (índice único, incluso baipaseando el Server
Action con un insert directo), y aislamiento — entre barberos de la misma
barbería y entre barberías distintas — tanto para `UPDATE` (cerrar la caja
ajena) como para `SELECT` (leerla) directo contra Supabase, sin pasar por
la UI.

- **CRUD:** `src/actions/cash.actions.ts` (`getCurrentCashSessionAction`,
  `openCashSessionAction`, `closeCashSessionAction`). `openCashSessionAction`
  no manda `user_id` ni `barbershop_id`: ambos se completan solos vía
  `default` en la migración (`current_user_id()` / `current_barbershop_id()`),
  mismo patrón que `services.barbershop_id`.
- **Una sola caja abierta por usuario:** garantizado por el índice único
  parcial `one_open_session_per_user` (`user_id` WHERE `status = 'open'`).
  `openCashSessionAction` traduce la violación de ese índice (SQLSTATE
  `23505`) a un mensaje entendible en vez de un error 500 — la barrera real
  es la base de datos, no un chequeo previo en la acción.
- **Permisos:** `SELECT`, `INSERT` y `UPDATE` están acotados al dueño de la
  fila (`cash_sessions_select_own` / `cash_sessions_insert_own` /
  `cash_sessions_update_own`, todas vía `current_user_id()` +
  `current_barbershop_id()`) — un barbero no puede leer ni mutar la caja de
  un compañero, ni siquiera dentro de la misma barbería. `closeCashSessionAction`
  no filtra por `user_id` a mano: si el `id` es de otro barbero, RLS bloquea
  el `update` y se trata como "no encontrada" (lo mismo pasaría con un
  `SELECT` directo a la API). Ver `decisiones.md` 2026-09-15 — el `SELECT`
  arrancó abierto a toda la barbería y se corrigió en la misma sesión.
- **`end_time` y `final_balance`:** calculados en `closeCashSessionAction`
  (servidor), nunca mandados desde un Client Component. Desde el
  2026-09-16, `final_balance` = saldo inicial + ingresos − egresos de
  `transactions`, con la misma función (`computeBalance`) que usa
  `getCashBalanceAction` para mostrar el "Saldo actual" en `/caja`. Si no
  se pueden leer las transacciones, la caja no se cierra. Ver
  `decisiones.md` 2026-09-15 (por qué el cálculo vive en el Server Action y
  no en un trigger) y 2026-09-16 (saldo compartido pantalla/cierre).
- **UI:** `(dashboard)/caja/page.tsx` (Server Component) decide entre
  `_components/OpenCashView.tsx` (si no hay caja abierta) y el dashboard de
  caja abierta con `_components/CloseCashButton.tsx` (confirmación in-line
  antes de cerrar, mismo patrón sin modal que el resto del dashboard).
  `OpenCashView` es un input de texto (`inputMode="numeric"`) grande estilo
  terminal POS, autofocus, con separador de miles en vivo
  (`Intl.NumberFormat("es-PY")`, prefijo `"Gs."` en vez del símbolo `₲` —
  `Zilla Slab` no tiene ese glifo) y tamaño de letra calculado en JS según
  la cantidad de caracteres ya formateados (no un `clamp()` con `vw`, que
  desbordaba el contenedor y recortaba el número en pantallas anchas). Ver
  `decisiones.md` 2026-09-15 (dos entradas: tamaño de letra y separador de
  miles).

### Flujo de Walk-ins y Temporizador (implementado)

Quinta rebanada vertical (`docs/specs/05-flujo-walkins-temporizador.md`).
Migración `20260916000000_create_appointments_and_transactions.sql`
(tablas `appointments` y `transactions`) aplicada contra el proyecto real
(`supabase db push`). Probado con Vitest (Supabase mockeado) **y** de
punta a punta en el navegador contra el proyecto real: crear un servicio,
abrir caja, iniciar un temporizador, sobrevivir a un F5 con el tiempo
corriendo, finalizar y cobrar (verificado el `appointment` y la
`transaction` resultantes directo contra la base), y el bloqueo de cobro
sin caja abierta.

- **Timers en Zustand, nunca en el servidor:** `src/store/timerStore.ts`
  guarda un arreglo de `{ id, startTime, label? }` con `persist` en
  `localStorage` — nunca los segundos transcurridos (eso se calcula en un
  `useEffect` local de `TimerCard.tsx`, comparando contra `Date.now()` cada
  segundo, para no re-renderizar toda la app cada tick). El store usa
  `persist(..., { skipHydration: true })` más el hook
  `useTimerStoreHydrated()` para rehidratar recién después del mount y
  evitar un hydration mismatch de SSR/Next.js (el HTML del servidor nunca
  tiene acceso a `localStorage`). Ver `docs/decisiones.md` 2026-09-15.
- **RLS estricta, igual que `cash_sessions`:** `appointments_select_own` /
  `appointments_insert_own` exigen `user_id = current_user_id()` además de
  `barbershop_id = current_barbershop_id()` — ni el dueño ve turnos ajenos
  todavía (queda para la spec 08 de estadísticas). `transactions` no tiene
  columnas propias de tenant/usuario (sigue el modelo original, solo
  `cash_session_id`): su aislamiento se resuelve con un `EXISTS` contra
  `cash_sessions` dentro de la policy. Ver `docs/decisiones.md` 2026-09-15
  (dos entradas: la decisión de RLS y la del `EXISTS`).
- **`completeWalkinAction`** (`src/actions/walkin.actions.ts`): verifica
  que la caja (`cashSessionId`) esté abierta y sea propia (RLS la trata
  como "no encontrada" si no), busca el servicio por `serviceId` y exige
  que esté activo, inserta el `appointment` (`status: "completed"`) y
  después la `transaction` (`type: "income"`). El monto nunca viene del
  cliente: es `services.price` leído en el servidor, y `end_time` se
  calcula con el reloj del servidor (mismo criterio que
  `closeCashSessionAction`) — a diferencia de lo que sugería la spec 05,
  que pasaba `amount`/`endTime` en el payload. `start_time` sí viene del
  cliente (es el `startTime` del timer local, la única fuente posible). Sin
  RPC atómico: son dos inserts separados; si el segundo falla se devuelve
  un error explícito para revisar el desfase a mano (deuda técnica
  documentada en la spec y en `docs/deuda-tecnica.md`).
- **UI:** `(dashboard)/inicio/page.tsx` (`/inicio`, no `(dashboard)/page.tsx`
  — esa ruta colisiona con la landing pública `src/app/page.tsx`; ver
  `docs/decisiones.md`) reemplaza a `/agenda` como destino post-login/
  registro (`/agenda` queda reservado para la spec 06, "Agenda de Turnos
  Programados"). `TimerList.tsx` (iniciar temporizadores + lista),
  `TimerCard.tsx` (cronómetro individual) y `FinishWalkinForm.tsx`
  (selección de servicio y cobro, in-line al pie de la card, sin modal —
  mismo patrón visual que servicios/equipo/caja) en
  `src/components/timers/`. Sin caja abierta, `FinishWalkinForm` bloquea el
  cobro con un aviso y un link a `/caja` en vez de mostrar el formulario.

### Navegación Minimalista (implementado)

Spec 05.5 (`docs/specs/05.5-navegacion-minimalista.md`). Conecta las
pantallas del dashboard con una barra de navegación inferior fija
(mobile-first), en vez de depender de URLs escritas a mano.

- **`BottomNav.tsx`** (`src/components/ui/`, Client Component — necesita
  `usePathname()`): 4 ítems fijos con íconos de
  [`lucide-react`](https://lucide.dev/) — Inicio (`Home`, `/inicio`), Caja
  (`Wallet`, `/caja`), Agenda (`Calendar`, `/agenda`) y Más
  (`MoreHorizontal`, `/mas`). El ítem activo se distingue por color
  (acento "Tinta") **y** por el grosor de trazo del ícono, no solo por
  color — pensado para uso a la luz del día. `(dashboard)/layout.tsx` la
  renderiza debajo de `<main>`, que ahora tiene `pb-16` para que el
  contenido no quede tapado detrás de la barra fija.
- **`(dashboard)/mas/page.tsx`:** catch-all para lo que no es de uso
  diario — links a `/servicios` y `/equipo`, más "Cerrar sesión" (reusa
  `logoutAction`). Desde el 2026-09-15 es el **único** lugar con
  "Cerrar sesión": la barra superior que lo duplicaba se eliminó, ver
  "Sistema de Diseño" más abajo.
  `Estadísticas` queda fuera tanto de la barra principal como de `/mas`
  hasta que tenga lógica real (spec 08) — ver `docs/decisiones.md`.
- **Cabecera de `/inicio`:** rediseñada el 2026-09-15, ver "Sistema de
  Diseño" más abajo para el estado actual.

### Sistema de Diseño: Tipografía, Íconos y Botones (implementado)

Pasada de refinamiento visual del 2026-09-15 sobre specs ya implementadas
(no es una spec nueva del backlog). Explorada primero en un Artifact
("Muestrario Clippr", varias rondas de comparación) antes de tocar código
real, mismo criterio que la dirección visual del 14/09. Ver
`docs/decisiones.md` (varias entradas 2026-09-15).

- **Tipografía — Inter reemplaza `Zilla Slab` + `Work Sans`:** una sola
  familia para todo (`src/app/layout.tsx`, vía `next/font/google`).
  `--font-sans` y `--font-display` en `globals.css` apuntan las dos a
  `--font-inter`, así que todo lo que ya usaba la clase `font-display`
  (precios, encabezados) hereda el cambio sin tocar cada componente.
  `Geist` (alternativa evaluada) no está en el catálogo de
  `next/font/google` de la versión de Next instalada.
- **Íconos — trazo fino global:** `BottomNav.tsx` baja el `strokeWidth`
  inactivo de 1.75 a 1.5 (el activo se mantiene en 2.25) — mismo
  contrato de color + grosor ya documentado el 15/09, solo afinado.
- **Botones — jerarquía + micro-interacción táctil:**
  `src/components/ui/Button.tsx` tiene 4 variantes: `primary`
  (`bg-accent`), `secondary` (`bg-surface-2`, sin borde), `ghost` (solo
  texto) y `danger` (con borde, sin cambios). Las cuatro suman
  `active:scale-95` (CSS puro, sin JS) para sensación de app nativa.
  Los botones de submit de login/registro, que quedaban en `bg-black`
  desde antes de que existiera el acento "Tinta", se migraron a
  `<Button>`.
- **`(dashboard)/layout.tsx` sin barra superior:** el `<nav>` con el
  nombre de la barbería y "Cerrar sesión" se eliminó — el logout ya vive
  en `/mas`. El layout ahora solo hace de guard de sesión
  (`auth.getUser()` + redirect) antes de `<main>` + `<BottomNav />`.
- **Cabecera de `/inicio`:** "Hola, {nombre de pila}" (sin emoji) más dos
  píldoras monocromas (`bg-surface-2`, ícono + texto: "Cortes de hoy" /
  "Tu racha") **sin números** — se mantiene a propósito el criterio del
  15/09 de no mostrar cifras hasta que exista lógica real (spec 08); un
  "0" fijo se leería como dato real y siempre diría lo mismo.
- **CTA "Iniciar corte" (`TimerList.tsx`):** reemplaza la fila
  input-chico + botón-chico por un botón de ancho completo con
  `active:scale-[0.98]`, estilo **contorno** (borde 1.5px en Tinta,
  fondo blanco, sin relleno sólido) — se probaron 4 variantes más
  (relleno con insignia circular, relleno sin insignia, compacto junto
  al input, franja con flecha) en el Artifact antes de elegir esta. El
  input "Servicio (opcional)" se conserva, más chico, arriba del botón:
  sigue siendo la única forma de distinguir timers concurrentes.

### Agenda de Turnos Programados (implementado)

Sexta rebanada vertical (`docs/specs/06-agenda-de-turnos-programados.md`).
Migración `20260916010000_appointments_update_own.sql` (política RLS de
`update` sobre `appointments`, faltante desde la spec 05 — ver
`docs/decisiones.md` 2026-09-16) aplicada contra el proyecto real
(`supabase db push`). Probado con Vitest (Supabase mockeado) **y** de
punta a punta en el navegador contra el proyecto real (2026-09-16). Esa
prueba encontró dos bugs (día cortado en UTC y `end_time` anterior a
`start_time`), corregidos en el sprint de estabilización del mismo día.

- **RLS de `update`, mismo criterio estricto que `select`/`insert`:**
  `appointments_update_own` exige `barbershop_id = current_barbershop_id()
  and user_id = current_user_id()`, igual que `appointments_select_own` /
  `appointments_insert_own` (spec 05) y `cash_sessions_update_own` (spec
  04). Sin esta policy, `completeScheduledAppointmentAction` y
  `cancelAppointmentAction` no podían actualizar ninguna fila (RLS
  bloqueaba el `UPDATE` en silencio) — ver `docs/decisiones.md`.
- **`src/actions/agenda.actions.ts`:**
  - **Fechas en `America/Asuncion` (`src/lib/dates.ts`):** "hoy", los
    cortes de día y el instante de un turno se calculan con la zona del
    negocio, nunca con `new Date()` pelado (el servidor corre en UTC).
  - `getAgendaAction(dateISO)` filtra `appointments` por el rango
    `[00:00, 00:00 del día siguiente)` en hora de Paraguay y por los estados
    `scheduled`/`completed`/`cancelled` (`walkin` existe en el check
    constraint pero ningún flujo lo usa todavía). El aislamiento por
    tenant/usuario lo resuelve RLS, no un `.eq()` a mano.
  - `scheduleAppointmentAction` recibe `dateISO` + `time` (HH:MM) y arma
    el instante en el servidor. Exige un `clientName` no vacío (a
    diferencia del walk-in, donde es opcional) y un servicio activo; deriva
    `end_time` sumando `duration_minutes` a `start_time` — nunca lo recibe
    del cliente. No valida que `start_time` sea futuro: la spec permite
    agendar en el pasado del mismo día (se anota tarde) o en el futuro.
  - `completeScheduledAppointmentAction` reusa los mismos principios que
    `completeWalkinAction` (spec 05): caja verificada y propia, precio
    leído de `services.price` en el servidor, `end_time` pisado con el
    reloj del servidor. El `update` filtra además por
    `status = "scheduled"`, así que un doble tap con red lenta no completa
    (ni cobra) el mismo turno dos veces — mismo criterio que
    `closeCashSessionAction`. Si se cobra antes de hora, `start_time` se
    corre a `ahora − duración` (la duración nunca queda negativa), y los
    turnos de días futuros no se pueden cobrar. Sin RPC atómico: mismo desfase potencial
    `appointment`/`transaction` que `completeWalkinAction`, ver
    `docs/deuda-tecnica.md`.
  - `cancelAppointmentAction` hace lo mismo con un `update` acotado a
    `status = "scheduled"`: "no existe", "es de otro barbero" (RLS) y "ya
    se había resuelto" devuelven el mismo mensaje genérico.
- **UI (`(dashboard)/agenda/`):** `page.tsx` (Server Component) reemplaza
  el placeholder de la spec 05.5/registro por la lógica real. La fecha
  vive en la URL (`?date=YYYY-MM-DD`, default: hoy en Paraguay) en vez de en
  estado de cliente, así que cada cambio de día es un fetch real al
  servidor — mismo criterio que el resto de la app (nada de estado
  "optimista" para datos que dependen del servidor).
  `_components/AgendaView.tsx` maneja la navegación día a día
  (`router.push` con el query param) y el toggle de
  `_components/ScheduleInlineForm.tsx` (in-line, sin modal — mismo patrón
  que servicios/equipo/caja/walk-ins). `_components/AppointmentRow.tsx`
  usa `useOptimistic` por fila para marcar completado/cancelado al toque;
  `router.refresh()` al resolver la promesa reconcilia con el estado real
  del servidor. Sin caja abierta, el botón "Cobrar" se deshabilita y
  aparece el mismo aviso con link a `/caja` que en `FinishWalkinForm`.

### Productos y Movimientos de Caja (implementado)

Séptima rebanada vertical (`docs/specs/07-productos-y-movimientos-caja.md`).
Migraciones `20260916020000_create_products_table.sql` y
`20260916030000_transactions_insert_open_session_only.sql` aplicadas
contra el proyecto real (`supabase db push`). Probado con Vitest (Supabase
mockeado) **y** de punta a punta en el navegador con una cuenta de dueño
(2026-09-16): crear/editar/desactivar producto, caja cerrada sin
movimientos, egreso e ingreso manual, venta bloqueada por falta de stock,
venta de 2 y de 1 unidad hasta "Sin stock", con el resultado verificado
directo en la base. Las RLS nuevas se probaron con scripts descartables
(caja cerrada, `stock >= 0`, aislamiento entre barberías). Con una cuenta
de barbero: `/productos` sin controles de edición, las tres acciones del
catálogo llamadas directo (sin la UI) devuelven "Acceso denegado" sin
cambiar nada, venta y movimiento bloqueados en el servidor sin caja
abierta, venta desde su propia caja con el stock compartido, y sin poder
leer ni cargar movimientos en la caja del dueño.

- **Tabla `products`:** `barbershop_id` con `default
  current_barbershop_id()`, `price integer > 0`, `stock integer >= 0`,
  `low_stock_threshold` nullable, `is_active` (borrado lógico). RLS de
  `select`/`insert`/`update` a toda la barbería, sin `delete`.
- **`transactions_insert_own` exige `status = 'open'`** en la caja
  referenciada: la base rechaza movimientos en una caja cerrada.
- **`src/actions/product.actions.ts`:** `getProductsAction` (cualquier
  integrante, activos primero), `createProductAction`,
  `updateProductAction` y `toggleProductStatusAction` (solo el dueño, se
  valida el rol en la acción).
- **`src/actions/cash.actions.ts`:** `registerTransactionAction` (ingreso o
  egreso manual con descripción obligatoria) y `sellProductAction`. Las dos
  resuelven la caja abierta del usuario en el servidor — el cliente no
  manda `cashSessionId`. La venta lee precio y stock de la base, aborta si
  la cantidad supera el stock, descuenta con un `update` condicionado al
  stock leído (dos ventas simultáneas no se pisan) e inserta el ingreso
  `precio × cantidad`. Sin RPC atómico: ver `docs/deuda-tecnica.md`.
  `computeBalance` no cambió: ya sumaba todas las transacciones.
- **UI:** `(dashboard)/productos/` (`ProductList` con switch optimista y
  `ProductInlineForm` in-line, mismos patrones que `/servicios`; los
  barberos ven la lista sin controles). Link en `/mas`. En `/caja`, debajo
  del cierre, la sección "Movimientos" con dos acordeones in-line:
  `TransactionInlineForm` (Egreso/Ingreso, monto con separador de miles vía
  `src/components/forms/useAmountInput.ts`, compartido con `OpenCashView`)
  y `SellProductForm` (solo si hay productos activos; los sin stock
  aparecen deshabilitados). El desglose del saldo dice "Ingresos" en vez de
  "Cobros", porque ahora incluye ventas e ingresos manuales.

## Modelo de Datos

Entidades principales enfocadas en resolver el modelo Multi-Tenant, los turnos y la gestión individual de caja:

- **Barbershop (Barbería):**
  - `id`, `name`, `subscription_plan` (trial, pro, team), `created_at`
- **User (Usuario - Dueño/Barbero/Independiente):**
  - `id`, `auth_id` (vinculado a Supabase Auth), `barbershop_id`, `role` (owner, barber, independent), `name`, `level` (junior, pro, senior, elite), `commission_pct`, `streak_count`
- **Product (Producto / Stock):**
  - `id`, `barbershop_id`, `name`, `price` (entero, guaraníes), `stock` (>= 0), `low_stock_threshold` (nullable), `is_active` (borrado lógico)
- **Service (Servicio ofrecido):**
  - `id`, `barbershop_id`, `name`, `price` (entero, guaraníes sin
    decimales), `duration_minutes`, `is_active` (activar/desactivar
    reversible desde la UI, no borrado — ver `decisiones.md`)
- **Appointment (Turno / Corte):**
  - `id`, `barbershop_id`, `user_id` (barbero asignado), `client_name`
    (nullable — ej. "Cliente de paso"), `service_id`, `start_time`,
    `end_time`, `status` (scheduled, walkin, completed, cancelled — los
    walk-ins se insertan directo como `completed`; los turnos de la agenda
    nacen `scheduled` y pasan a `completed` o `cancelled`. `walkin` no se usa
    todavía)
  - `client_name` es obligatorio al agendar (spec 06), opcional en walk-ins.
  - Al completar un turno agendado antes de hora, `start_time` se corre a
    `end_time − duración` para que la duración nunca sea negativa.
- **CashSession (Sesión de Caja Diaria por Barbero):**
  - `id`, `barbershop_id`, `user_id`, `start_time`, `end_time`, `initial_balance`, `final_balance`, `status` (open, closed)
  - `end_time` y `final_balance` son `null` mientras `status` = `open`.
    Al cerrar, `final_balance` = `initial_balance` + ingresos − egresos.
  - Índice único parcial `one_open_session_per_user` (`user_id` WHERE
    `status = 'open'`): un usuario no puede tener más de una caja abierta.
- **Transaction (Movimiento de Caja):**
  - `id`, `cash_session_id`, `type` (income, expense), `amount`, `description`, `created_at`

## Estructura de Carpetas

Estructura basada en Next.js App Router, separando claramente la lógica de negocio de la interfaz de usuario:

```text
/public               # Assets estáticos y PWA
  /icons              # Íconos para la app en iOS/Android
  manifest.json       # Manifiesto de la PWA para instalación
/supabase
  /migrations         # SQL versionado (schema, RLS, RPC)
  config.toml         # Config del Supabase CLI (proyecto linkeado)
/src
  /app                # Rutas de la aplicación (Next.js App Router)
    layout.tsx        # Layout raíz (metadata, PWA)
    globals.css       # Tailwind v4 (@import "tailwindcss")
    /api
      /health         # Health check (GET /api/health)
    /(auth)           # login/ y registro/ (implementado)
      /__tests__      # auth.test.tsx (Vitest + Testing Library)
    /(dashboard)      # Layout (guard de sesión + BottomNav, implementado)
      /inicio         # Timers + walk-ins, pantalla principal del barbero (implementado, spec 05)
      /agenda         # Turnos programados: page.tsx + _components/ (implementado, spec 06)
      /servicios      # Catálogo de servicios (implementado, spec 02)
      /equipo         # Gestión de equipo/barberos (implementado, spec 03)
      /caja           # Apertura/cierre de CashSessions, movimientos y ventas (implementado, specs 04 y 07)
      /productos      # Catálogo de productos y stock (implementado, spec 07)
      /mas            # Catch-all: Servicios, Productos, Equipo, Cerrar sesión (implementado, spec 05.5)
      /estadisticas   # Reportes e insights (vacío, .gitkeep — fuera de la barra por ahora)
  /components
    /ui               # Componentes base reutilizables (Button, Input, Switch, BottomNav)
    /forms            # useAmountInput.ts (monto con separador de miles, spec 07)
    /timers           # TimerList.tsx, TimerCard.tsx, FinishWalkinForm.tsx (implementado, spec 05)
  /lib
    /supabase         # Clientes de Supabase: client.ts (browser), server.ts (servidor), admin.ts (Service Role Key, solo servidor)
    utils.ts          # Funciones utilitarias generales (incluye formatGuaranies)
    dates.ts          # Fechas del negocio en America/Asuncion (+ dates.test.ts)
  /actions            # Server Actions — auth, service, product, team, cash, walkin, agenda (.actions.ts, implementados)
  /store              # Estado global del frontend (Zustand) — timerStore.ts (implementado, spec 05)
  /types              # Definiciones de tipos e interfaces TypeScript

# Raíz: next.config.ts, tsconfig.json, eslint.config.mjs, vitest.config.ts,
#       vitest.setup.ts, postcss.config.mjs, .prettierrc.json, .env.example
```

`(auth)`, `(dashboard)/layout.tsx`, `(dashboard)/inicio`,
`(dashboard)/agenda`, `(dashboard)/servicios`, `(dashboard)/equipo`,
`(dashboard)/caja`, `(dashboard)/productos` y `(dashboard)/mas` ya tienen
lógica real — ver "Auth y Multi-Tenant", "Flujo de Walk-ins y
Temporizador", "Agenda de Turnos Programados", "Productos y Movimientos de
Caja", "Navegación Minimalista", "Sistema de Diseño", "Catálogo de
Servicios", "Gestión de Equipo" y "Sesión de Caja Diaria" más arriba.
`estadisticas/` sigue vacío (`.gitkeep`): es el esqueleto
para las próximas specs.

## Las 3 Decisiones Técnicas Más Riesgosas y su Alternativa

1. **Riesgo: Lógica crítica de negocio en el cliente**
   - **Decisión:** Mover **toda** la lógica de mutación sensible (completar turnos, actualizar balance de caja, calcular rachas) a **Next.js Server Actions** en el servidor. Esto evita de raíz las condiciones de carrera detectadas en la v1 y las manipulaciones de datos.
   - **Alternativa:** Resolverlo mediante Triggers y Procedimientos Almacenados (RPC) directamente en PostgreSQL (Supabase). Es más seguro y veloz, pero puede ser más difícil de mantener y "debuggear" para un solo dev que prefiere escribir la lógica en TypeScript.

2. **Riesgo: Arquitectura Multi-Tenant y Seguridad de Datos**
   - **Decisión:** Usar **Row Level Security (RLS)** nativo de Supabase. Configurar políticas a nivel de base de datos para garantizar que un barbero/dueño solo pueda leer y modificar información donde el `barbershop_id` coincida con su afiliación.
   - **Alternativa:** Filtrar los datos a nivel de aplicación (ej. añadir `WHERE barbershop_id = X` en cada Server Action). Es muy riesgoso porque un olvido humano expondría los datos de una barbería a otra, vulnerando la privacidad de los clientes.

3. **Riesgo: Conexión inestable y múltiples temporizadores**
   - **Decisión:** Seguir utilizando el estado local con `Zustand` y persistencia en `localStorage`, pero rediseñando el store para que soporte un **arreglo de temporizadores** en lugar de uno único. Esto permite flujos concurrentes (ej. esperar que actúe un tinte mientras se atiende a otro cliente) y tolera caídas de internet o recargas de página. Al finalizar un servicio, se encola la sincronización con el servidor.
   - **Alternativa:** Mantener el estado de los temporizadores sincronizado en tiempo real en el servidor (con Supabase Realtime). Se descartó porque requiere conexión constante, lo cual viola la restricción de "internet inestable" y penalizaría la experiencia del barbero si su red se cae por unos minutos.
