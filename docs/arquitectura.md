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
- **Contraseña temporal (2026-09-16):** cada cuenta nueva se crea con una
  contraseña aleatoria de 6 caracteres (`src/lib/passwords.ts`), que
  `createBarberAction` devuelve una sola vez y `BarberInlineForm` le muestra
  al dueño (con "Copiar"); no se guarda en ningún lado. El barbero la puede
  cambiar, si quiere, en `/mas/cambiar-password` (`changePasswordAction`,
  pide la actual). Sin cambio forzado ni recuperación por email todavía —
  ver `decisiones.md` y `deuda-tecnica.md`. Verificado contra el Supabase
  real con un usuario descartable (alta, login, cambio, login con la vieja
  rechazado).
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
  `appointments_insert_own` exigían `user_id = current_user_id()` además de
  `barbershop_id = current_barbershop_id()` — ni el dueño veía turnos ajenos.
  Desde la spec 08 el `select` (no el insert/update) deja pasar también al
  dueño de la barbería, ver "Estadísticas, Niveles y Rachas" más abajo. `transactions` no tiene
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

> **Ampliado el 2026-09-20.** El temporizador ya no es sólo para el cliente
> de paso: un turno agendado también se puede cronometrar desde `/inicio`
> (`Timer.appointmentId`), y se cierra con `FinishAppointmentForm` en vez de
> `FinishWalkinForm`. El aviso de caja cerrada salió de `FinishWalkinForm` a
> `SinCajaAviso.tsx`, compartido por los dos. El botón "Iniciar corte" pasó
> de contorno a relleno con el rediseño bento. Ver "Empezar un turno desde
> /inicio" más abajo.

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
  `Estadísticas` se sumó a `/mas` en la spec 08 (sigue fuera de la barra
  principal, que se mantiene en 4 íconos de uso diario) — ver
  `docs/decisiones.md`.
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
  píldoras monocromas (`bg-surface-2`, ícono + texto). Estuvieron **sin
  números** hasta la spec 08, a propósito, porque no había lógica real
  detrás; desde la spec 08 muestran los valores del día ("3 cortes hoy",
  "Racha de 5 días") y linkean a `/estadisticas`.
- **CTA "Iniciar corte" (`TimerList.tsx`):** reemplaza la fila
  input-chico + botón-chico por un botón de ancho completo con
  `active:scale-[0.98]`, estilo **contorno** (borde 1.5px en Tinta,
  fondo blanco, sin relleno sólido) — se probaron 4 variantes más
  (relleno con insignia circular, relleno sin insignia, compacto junto
  al input, franja con flecha) en el Artifact antes de elegir esta. El
  input "Servicio (opcional)" se conserva, más chico, arriba del botón:
  sigue siendo la única forma de distinguir timers concurrentes.

> **Superado en parte el 2026-09-20.** La cabecera de `/inicio` y el CTA
> "Iniciar corte" cambiaron con el pase a bento: las píldoras son ahora dos
> cubos y el CTA pasó de contorno a **relleno**. Lo que sigue vigente de
> esta sección es la tipografía, los íconos y el sistema de botones. Ver
> "Bento UI y Modo Oscuro" más abajo.

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

### Estadísticas, Niveles y Rachas (implementado)

Octava rebanada vertical (`docs/specs/08-estadisticas-niveles-rachas.md`).
Migración `20260917000000_owner_stats_visibility.sql`, aplicada contra el
proyecto real (`supabase db push`). Probado con Vitest (Supabase mockeado)
**y** de punta a punta en el navegador el 2026-09-17, con una cuenta de
barbero y una de dueño de la misma barbería (ver "Prueba de punta a punta"
más abajo). Las dos reglas de negocio que la spec dejaba abiertas (umbrales
de nivel y qué es un "día hábil") se consultaron con el usuario y quedaron
escritas en la sección 6 de la spec y en `docs/decisiones.md`.

- **RLS: el dueño ve a su equipo.** `public.current_user_role()`
  (`SECURITY DEFINER`, mismo patrón que `current_barbershop_id()` /
  `current_user_id()`, para no recursar al leer `users` dentro de una policy
  de `users`) habilita el criterio nuevo de las policies de `select` de
  `cash_sessions`, `appointments` y `transactions`:
  `barbershop_id = current_barbershop_id() and (user_id = current_user_id()
  or current_user_role() = 'owner')`. `insert`/`update` siguen estrictos: el
  dueño lee lo ajeno, no lo escribe. **Consecuencia a tener presente:**
  ninguna consulta puede seguir asumiendo que RLS la acota a lo propio sobre
  esas tres tablas — `getAgendaAction` pasó a filtrar `user_id` a mano para
  que `/agenda` siga siendo la agenda personal y no la de la barbería.
- **Niveles = ligas de 30 días (`src/lib/levels.ts`):** `levelForCuts`
  (junior < 40, pro 40–90, senior 91–150, élite 151+) y `levelProgress`
  (avance dentro del tramo actual, no sobre el total, para que un recién
  ascendido no vea la barra vacía). El nivel puede bajar. Los umbrales viven
  acá, no en el Server Action.
- **Racha con día de gracia (`src/lib/streaks.ts`):** `nextStreakCount` es
  lógica pura (sin Supabase) para poder testear los casos borde. Una jornada
  cuenta si el barbero cerró una caja con al menos un ingreso; se compara por
  `start_time` (cerrar a las 2 AM sigue siendo la jornada anterior) con
  tolerancia de 2 días.
- **`updateStreakAndLevel`** (privada en `cash.actions.ts`, llamada por
  `closeCashSessionAction` **después** del cierre): resuelve nivel y racha y
  guarda las dos en `users`. Si falla, loguea y no propaga el error — la caja
  ya está cerrada con su saldo correcto (ver `docs/decisiones.md`).
- **`src/actions/stats.actions.ts`:** `getBarberStatsAction(dateISO)`
  (cortes del día, cobrado del día, racha, nivel y progreso de la ventana),
  `getOwnerStatsAction(desde, hasta)` (ingresos, cortes, promedio diario y
  leaderboard por barbero; **valida `role === 'owner'` en el servidor** además
  de RLS, y corta antes de tocar los datos del equipo) y
  `getCurrentRoleAction()`. Todos los rangos se cortan con `@/lib/dates` en
  `America/Asuncion`. `transactions` no tiene `user_id`, así que el ingreso
  por barbero sale de dos consultas: sus `cash_sessions` del rango y después
  los movimientos de esas cajas.
- **UI:** `(dashboard)/estadisticas/page.tsx` decide por rol —
  `OwnerDashboard` (filtros "Hoy / Esta semana / Este mes" como links
  `?rango=`, mismo criterio que `?date=` en la agenda: cada cambio es un
  fetch real, sin estado de cliente) o `BarberDashboard` (KPIs del día,
  racha, nivel y barra de progreso). Sin librerías de gráficos: las barras
  son `div`s con `width` en porcentaje. Los dashboards son de sólo lectura,
  así que no usan `useOptimistic` ni Zustand. `/inicio` dejó de tener las
  píldoras estáticas: ahora muestran los números reales del día y linkean a
  `/estadisticas` (si la consulta falla, vuelven al texto sin cifras en vez
  de tumbar la pantalla donde el barbero arranca los cortes).
  `Estadísticas` entra en `/mas`, no en la `BottomNav`: la barra se mantiene
  en 4 íconos de uso diario.

- **Prueba de punta a punta (2026-09-17, proyecto real):** con el barbero —
  estado vacío ("Todavía no hay actividad hoy"), cobro de un walk-in,
  píldoras de `/inicio` con números reales, cierre de caja con la racha
  pasando de 0 a 1 y después de 1 a 2 en días consecutivos, todo verificado
  contra la base. Con el dueño — leaderboard con los datos del barbero (lo
  que la migración habilita), filtros Hoy/Semana/Mes con los totales
  cruzados contra las `transactions` de la base, `/agenda` vacía a pesar de
  que el barbero tiene turnos ese día (el filtro `user_id` nuevo), `/caja`
  mostrando la propia y `/inicio` con sus métricas personales, no las del
  negocio. Esa prueba encontró un bug que se corrigió en el acto: "cobrado
  hoy" se recortaba por el día de apertura de la caja, así que una caja
  abierta la noche anterior y todavía sin cerrar mostraba "1 corte hoy"
  junto a "Gs. 0 cobrado hoy". El recorte pasó a `transactions.created_at`
  y las cajas se buscan por intersección con el rango.

### Estabilización, Seguridad y Pulido (spec 09, pasos 1–4 implementados)

Novena rebanada (`docs/specs/09-estabilizacion-y-pulido.md`). Cuatro migraciones
nuevas, **aplicadas** contra el proyecto real con `supabase db push` el
2026-09-20: `20260920000000_atomic_charge_rpcs.sql`,
`20260920010000_users_update_hardening.sql`,
`20260920020000_transactions_category.sql` y
`20260920030000_revoke_rpc_from_anon.sql`. Probado con Vitest (Supabase
mockeado) y verificado contra la base por SQL y por HTTP a PostgREST (ver
"Verificación" más abajo). El paso 5 de la spec (tests E2E de RLS
automatizados) quedó fuera a propósito, con el plan escrito en
`docs/deuda-tecnica.md`. Cuatro puntos donde la spec no cerraba contra el
código se consultaron antes de implementar y quedaron en `docs/decisiones.md`.

- **Cobros atómicos (paso 1).** `complete_walkin_and_charge`,
  `complete_appointment_and_charge` y `sell_product_and_charge`: cada una hace
  todas las escrituras de un cobro dentro de una sola transacción de Postgres,
  así que "el corte se guardó pero no entró a la caja" y "se descontó el stock
  pero no se cobró" dejaron de ser estados posibles. `completeWalkinAction`,
  `completeScheduledAppointmentAction` y `sellProductAction` pasaron de dos o
  tres consultas a una sola llamada `.rpc(...)`. Las tres son SECURITY DEFINER
  (saltean RLS) y revalidan a mano caja propia y abierta, y servicio/producto
  del mismo tenant — `assert_open_cash_session` centraliza lo primero. El monto
  lo lee la función de `services.price` / `products.price`: nunca llega por
  parámetro. El `for update` reemplaza al update condicionado al stock leído y
  al `eq("status", "scheduled")` como barrera contra ventas y cobros dobles.
  Los errores de negocio viajan como SQLSTATE propios de la clase `CL`
  (`src/lib/db-errors.ts`) para que el Server Action siga mostrando el mensaje
  exacto en vez de uno genérico.
- **`users` cerrado (paso 2).** `users_update_same_barbershop` (spec 01) dejaba
  a cualquier integrante escribir cualquier fila de su barbería: un barbero
  podía inflarse `streak_count` desde la consola. Ahora: policy
  `users_update_own` (sólo la fila propia) + `grant update (name)` (sólo esa
  columna, porque una policy no puede mirar qué campo cambió) + dos caminos con
  privilegio propio para lo legítimo — `update_team_member` (SECURITY DEFINER,
  valida `owner` y misma barbería) para `/equipo`, y `createAdminClient()`
  (`service_role`) para `applyStreakAndLevel`. Ese último quedó envuelto en
  try/catch: si falta `SUPABASE_SERVICE_ROLE_KEY`, el cierre de caja igual se
  reporta como exitoso, que es la regla del 2026-09-17.
- **`transactions.category` (paso 3).** `service` / `product` / `manual`, con
  `check` e índice. `sumIncome` (`stats.actions.ts`) devuelve el ingreso
  abierto en total y sólo-cortes, y `getOwnerStatsAction` calcula
  `averageTicket` con `totalServiceIncome / totalCuts`: el ticket promedio dejó
  de mezclar cortes con ventas de cera y propinas. "Ingresos" sigue siendo todo
  lo que entró a la caja. Las filas viejas se backfillean por el prefijo de
  `description`, que es el criterio que se usaba a ojo hasta ahora.
- **Pulido (paso 4).** `/agenda` ya no muestra "Cobrar" en un día futuro (el
  servidor siempre lo rechazaba, pero `useOptimistic` alcanzaba a pintar
  "Cobrado" por unos segundos); el "es un día futuro" lo decide el servidor en
  `agenda/page.tsx` y baja como prop, para que el día del negocio no dependa
  del reloj del celular ni difiera entre el render del servidor y el del
  cliente. En `/equipo`: "Agregar barbero" en oración normal, "Correo" →
  "Email" y sin el "0%" de comisión al lado del dueño. Los cuatro
  `text-red-600` sueltos (login, registro, equipo, servicios) pasaron al token
  `text-danger`.

- **Verificación (2026-09-20, proyecto real).** Las cuatro migraciones se
  aplicaron sin errores de SQL. Contra la base: las cinco funciones existen con
  la firma esperada y `prosecdef = true`; `authenticated` quedó con `UPDATE`
  sobre **una sola** columna de `users` (`name`) y `anon` sin ninguna, mientras
  `service_role` las conserva todas; `users_update_same_barbershop` ya no
  existe y quedó `users_update_own (id = current_user_id())`; el backfill de
  `category` clasificó las 14 filas que ya había (9 `service`, 3 `product`,
  2 `manual`). Contra PostgREST, con la anon key y el header
  `application/vnd.pgrst.object+json` que pone `.single()`: los cuatro RPC son
  alcanzables y **los SQLSTATE de la clase `CL` llegan como `error.code`**, que
  es de lo que dependen los `switch` de los Server Actions.

  Esa prueba encontró un problema y lo corrigió: el
  `revoke execute ... from public` de las dos primeras migraciones **no dejaba
  afuera a `anon`**. Supabase tiene un `alter default privileges` que le da
  `execute` explícito a `anon` sobre cada función nueva del schema `public`, y
  un revoke sobre PUBLIC no toca un grant explícito — `proacl` mostraba
  `anon=X/postgres` y un POST anónimo entraba al cuerpo de la función. No había
  fuga (las cinco cortan con CL008 apenas ven `current_user_id()` en null), pero
  la barrera estaba adentro y no en la puerta. La migración
  `20260920030000_revoke_rpc_from_anon.sql` lo cierra: ahora un POST anónimo
  devuelve `42501 permission denied for function`.

- **Prueba de punta a punta (2026-09-20, proyecto real, cuenta de dueño).**
  Cero errores de servidor y de consola. Se probó:
  - **Walk-in:** timer, finalizar y cobrar. El `appointment` quedó `completed`
    con el `client_name` recortado, `start_time` del timer y `end_time` del
    reloj del servidor. La prueba de atomicidad es que el `created_at` de la
    `transaction` es **idéntico** al `end_time` del turno
    (`14:47:00.508146`): `now()` es estable dentro de una transacción de
    Postgres, así que ese valor repetido sólo puede salir de un único commit.
    Monto 45.000 leído por el RPC, `category = 'service'`.
  - **Agenda:** turno agendado y cobrado, sin error. Confirma que
    `.rpc(...).single()` deserializa bien un retorno compuesto
    (`returns public.appointments`), que era el riesgo abierto.
  - **Día futuro:** un turno del día siguiente muestra "Se cobra el día del
    turno" en lugar del botón, y el de hoy sí muestra "Cobrar".
  - **Venta:** 2 unidades descontaron el stock de 3 a 1 y entraron 40.000
    (precio × cantidad, leído por el RPC) con `category = 'product'`. Al
    intentar vender 5 con 1 en stock, la pantalla mostró "No hay stock
    suficiente de Cera spec09 (quedan 1)" y el stock **no se movió**: el
    rollback funciona y el mensaje se arma bien con `error.message` (nombre) y
    `error.details` (stock) del `raise` CL006. `SellProductForm` no valida la
    cantidad contra el stock en el cliente, así que ese texto vino del
    servidor.
  - **Movimiento manual:** egreso con `category = 'manual'`. El saldo siguió
    la cuenta en cada paso (50.000 → 140.000 → 128.000 → 168.000) y el cierre
    guardó 168.000 como `final_balance`.
  - **Ticket promedio:** con 130.000 de ingresos, 2 cortes y una venta de
    40.000, la pantalla muestra **45.000** ("Sólo cortes, sin productos").
    Antes mostraba 130.000 / 2 = 65.000.
  - **`/equipo`:** "Agregar barbero" en oración normal, "Email" en el alta, el
    dueño sin el "0%" y el barbero con su porcentaje. Editar nivel y comisión
    de un barbero funciona — y sólo puede haber pasado por `update_team_member`,
    porque `authenticated` ya no tiene el grant sobre esas columnas.
  - **Cierre y gamificación:** la racha pasó de 0 a 1, escrita por
    `service_role`. Si el cambio de grants hubiera roto ese camino, habría
    quedado en 0.
  - **El agujero cerrado, comprobado de frente:** con `set local role
    authenticated`, un `update` de `streak_count` o de `commission_pct` sobre
    `users` devuelve `42501 permission denied`, mientras que uno de `name`
    pasa. Las tres capas hacen lo que dicen.

### Bento UI y Modo Oscuro (implementado)

Pasada visual del 2026-09-20 sobre specs ya implementadas (no es una spec
nueva del backlog), explorada primero en el canvas "Muestrario Clippr"
(artboards H a K para bento, L a O para el glassmorphism que se descartó)
antes de tocar código. Ver `docs/decisiones.md` (varias entradas
2026-09-20).

**La primitiva — `src/components/ui/Tile.tsx`:**

- `tileClasses(variant, className)` da las clases del cubo sin fijar el
  elemento, para que un cubo que navega sea un `<a>` de verdad y uno que
  abre un panel sea un `<button>`. **No fija la dirección del flex**: un
  `flex-row` en `className` no podría pisar un `flex-col` de la base
  (pesan igual y gana el orden de la hoja de estilos, no el del atributo).
- `Tile` es el `div` de siempre, con `flex-col`. Tres variantes:
  `default` (`bg-surface-2` + borde), `filled` (`bg-accent` +
  `text-accent-contrast`) y `plain` (fondo de página + borde).
- `StatTile` es el cubo de un número: ícono arriba, cifra grande abajo.
  Reemplaza al `StatCard` de la spec 08, que se borró. Sin `value` dibuja
  sólo la etiqueta — el caso de "la consulta falló y no inventamos un
  número".
- Regla que se mantiene de `Button`: **un solo cubo relleno por pantalla**.
  El radio sale de `--radius-tile` (`rounded-tile`), en `globals.css`.

**Tokens (`src/app/globals.css`):** el acento se partió en `--accent`
(relleno), `--accent-contrast` (texto sobre el relleno) y `--accent-ink`
(acento como texto/ícono sobre el fondo), y se sumó `--success`. Todo
`text-white` sobre `bg-accent` pasó a `text-accent-contrast` y todo
`text-accent` de texto pasó a `text-accent-ink`, en los ocho lugares donde
estaba.

**Modo oscuro:** bloque `[data-theme="dark"]` con la paleta oscura (misma
familia Tinta, aclarada). El tema se guarda en la cookie `clippr-theme`
(`src/lib/theme.ts`), la lee el servidor en `src/app/layout.tsx` y baja
como `data-theme` en el `<html>` — sin parpadeo y sin desajuste de
hidratación. `generateViewport()` hace que el `theme-color` del navegador
acompañe. El switch es `src/components/ui/ThemeSwitch.tsx` en `/mas`, que
escribe el `dataset.theme` y la cookie **desde el cliente** (funciona con
la red caída). `@custom-variant dark` reapunta `dark:` a `data-theme`, para
que nadie lo use creyendo que sigue al switch.

**Las tres pantallas:**

- **`/inicio`:** cabecera con la fecha del negocio y las iniciales que
  llevan a `/mas`; dos cubos compactos (racha y cortes de hoy) **arriba**
  del cubo relleno de "Iniciar corte"; los temporizadores activos; y
  `_components/UpcomingAppointments.tsx` con los turnos `scheduled` de hoy
  (hasta 4, con botón "Empezar" — ver "Empezar un turno desde /inicio" más
  abajo). **Sin caja y sin nivel.** Suma
  `getAgendaAction(businessToday())` al `Promise.all` que ya había y resuelve
  los nombres de servicio con el catálogo que la página ya traía: cero
  consultas nuevas. Sigue pidiendo la caja aunque no la muestre, porque
  `TimerList` necesita el `cashSessionId` para cobrar. Si fallan las
  estadísticas o la agenda, la pantalla igual renderiza.
- **`/caja`:** cubo relleno con el saldo y tres sub-cubos (Inicial /
  Ingresos / Egresos) adentro; `_components/CashActionsBento.tsx` con los
  tres cubos de acción (Ingreso · Egreso · Vender) que despliegan **en
  línea** los formularios de la spec 07 — que pasaron a ser controlados
  (`TransactionInlineForm` recibe el `type` por prop en vez de tener su
  propio selector; los dos reciben `onClose`); y
  `_components/CashMovements.tsx`, la lista de los últimos movimientos.
  `OpenCashView` queda como estaba: es una pantalla de un solo foco (spec
  04), no una grilla.
- **`/estadisticas`:** `OwnerDashboard` con cubo relleno de ingresos del
  rango, dos cubos (Cortes / Ticket promedio), fila fina de Promedio diario
  y el cubo de Equipo con las barras que ya existían. `BarberDashboard` con
  dos cubos y el cubo relleno de nivel + racha — **el nivel vive acá**, que
  es el único lugar con espacio para explicar la ventana móvil de 30 días.

**Dato nuevo — `getCashMovementsAction(sessionId)`** en
`src/actions/cash.actions.ts`: los últimos 8 movimientos de una caja
propia, del más nuevo al más viejo. Sin migración: `transactions` ya tenía
`description` y `created_at` desde la spec 05 y `category` desde la 09. No
repite filtro por usuario porque `transactions_select_own` resuelve el
aislamiento con un EXISTS contra la `cash_session` referenciada — atajo que
**no** vale para `appointments` ni `cash_sessions`, donde la spec 08 abrió
el select al dueño. El saldo sigue saliendo de `getCashBalanceAction`, que
suma en la base: la lista está recortada y sumarla daría otro número.

**Formateadores de fecha centralizados:** `formatBusinessDateLabel`,
`formatBusinessTime` y `formatBusinessDateTime` pasaron a
`src/lib/dates.ts`; `AgendaView`, `AppointmentRow` y `caja/page.tsx` tenían
cada uno su propio `Intl.DateTimeFormat` con la zona a mano. Dos cosas que
quedaron a la vista al unificar: `es-PY` formatea la hora en **12 horas**
("3:30 p. m."), que es lo que la app muestra desde la spec 06 y se dejó
igual (**pasó a 24 h el 2026-10-03**, ver "Tema Recibo"); y Paraguay dejó de mover el reloj en 2024, así que está fijo en
UTC−3.

**Qué se verificó (2026-09-20):** `npm run lint`, `npm run typecheck` y
`npm test` (203 tests, 19 archivos) en verde, y `npm run build` completo
con las 14 rutas. El mecanismo del tema se probó contra el server de
producción: sin cookie da `data-theme="light"`, con `clippr-theme=dark` da
`dark`, una cookie basura cae en claro, y el `theme-color` acompaña
(`#ffffff` / `#0f141b`). En el CSS servido están el selector
`[data-theme=dark]`, los seis valores de la paleta oscura, los dos
`color-scheme` y las seis utilidades nuevas.

**Qué NO se verificó:** el recorrido visual de las pantallas autenticadas
(`/inicio`, `/caja`, `/estadisticas`, `/mas`) en los dos temas, y el
contraste real de los cubos rellenos en oscuro. Requiere una sesión
iniciada en el navegador, que esta pasada no pudo hacer. Es lo primero a
mirar en la próxima sesión.

### Empezar un turno desde /inicio (implementado)

Pedido del usuario del 2026-09-20: poder arrancar el corte de un turno
agendado sin salir de `/inicio`. Abajo del pedido había un hueco de modelo:
**un turno agendado no se podía cronometrar** — el temporizador existía sólo
para el cliente de paso, y el turno saltaba de `scheduled` a `completed` con
"Cobrar" en `/agenda`. Ver `docs/decisiones.md` (2026-09-20, cuatro
entradas). **Sin migraciones.**

**El temporizador se vincula al turno** (`src/store/timerStore.ts`): `Timer`
gana `appointmentId` y `serviceId` opcionales, y `startTimer` pasa a recibir
un objeto. **Sin `appointmentId` es un walk-in**, igual que antes, así que
lo que ya estaba en `localStorage` sigue andando sin migrar nada. El store
no permite dos temporizadores para el mismo turno (el doble tap en un
celular pasa): devuelve el que ya estaba corriendo.

**El flujo:** "Empezar" en la fila de `/inicio` →
`startTimer({ appointmentId, serviceId, label: clientName })` → el turno
desaparece de "Lo que viene" y aparece como temporizador con el cliente y el
servicio → "Finalizar" → `FinishAppointmentForm` cobra con
`completeScheduledAppointmentAction`, que ya existía. El botón **no** exige
caja abierta: arrancar el contador es estado local y tiene que funcionar con
la red caída (regla 4); la caja se pide recién al cobrar.

**Componentes:**

- `UpcomingAppointments.tsx` pasó de Server Component a **client
  component**: el filtro de "ya está corriendo" depende del store. Los datos
  siguen bajando por props desde el servidor. Antes de rehidratar muestra
  **todos** los turnos, que es lo que renderizó el servidor — filtrar con el
  store vacío daría un HTML distinto y React tiraría un error de hidratación.
- `TimerCard.tsx` elige el formulario de cierre según `timer.appointmentId`,
  y muestra el servicio y el precio cuando el timer es de un turno.
- `FinishAppointmentForm.tsx` (nuevo) no pregunta nada y ofrece **Descartar**
  y **Reintentar** ante cualquier error, sin mirar el texto del mensaje: el
  caso a cubrir es el turno cobrado o cancelado desde `/agenda` mientras el
  timer corría (`CL004`), que antes dejaba un temporizador imposible de
  cerrar. Descartar no pierde plata: si el turno sigue agendado se cobra
  desde `/agenda`.
- `SinCajaAviso.tsx` (nuevo): el aviso de caja cerrada, extraído de
  `FinishWalkinForm` para que lo usen los dos formularios.
- `TimerList` recibe ahora **todos** los servicios y filtra los activos
  internamente para el `select` del walk-in (mismo patrón que `AgendaView`):
  un turno en curso puede apuntar a un servicio que se desactivó después y
  su nombre igual tiene que mostrarse.

**Un bug aparte, del mismo día:** las tres acciones de `agenda.actions.ts`
revalidaban sólo `/agenda`. Como `/inicio` también lista esos turnos desde
el rediseño bento, agendar en `/agenda` dejaba a `/inicio` con la lista
vieja. Ahora las tres revalidan `/inicio` también.

**Una trampa del stack que costó un 500:** `useTimerStore.persist` **no
existe en el servidor** — sin `localStorage`, el middleware `persist` de
Zustand devuelve el store pelado. Leerlo en el inicializador de un
`useState` (o sea, durante el render, que para un client component también
corre en el servidor) tumbó `/inicio`. Los accesos van con `?.` y hay un
test que lo fija. Hermana de la trampa de `crypto.randomUUID` de la spec 09.

**Qué se verificó:** lint, typecheck y **223 tests** (nuevos: el store
completo, incluida la regresión de SSR; "Empezar" en
`UpcomingAppointments`; y `FinishAppointmentForm`). En el dev server contra
el proyecto real, `/inicio` sirve 200 sin errores después del arreglo.
**Falta** el recorrido a mano del flujo completo con sesión iniciada
(empezar, F5 con el timer corriendo, cobrar y verificar la `transaction`).

### Deploy en Cloudflare Workers (implementado)

La app se publica en **Cloudflare Workers** con el adaptador OpenNext
(`@opennextjs/cloudflare`), no en Vercel: el plan gratis de Vercel prohíbe
el uso comercial (ver `docs/decisiones.md` 2026-10-03).

- **Configuración:** `wrangler.jsonc` (Worker `clippr-v2`, `nodejs_compat`,
  `observability` prendido para medir la CPU por pedido),
  `open-next.config.ts` sin caché incremental (todas las rutas son
  dinámicas: leen la cookie de sesión) y `public/_headers` con caché
  inmutable para `/_next/static`. El nombre `clippr-v2` es a propósito: en
  la misma cuenta de Cloudflare hay otro proyecto, y un Worker con el mismo
  nombre lo pisaría.
- **Variables:** las `NEXT_PUBLIC_*` se incrustan al compilar desde
  `.env.local`; `SUPABASE_SERVICE_ROLE_KEY` es un secreto del Worker
  (`wrangler secret put`) y en local va en `.dev.vars` (ignorado por git).
- **Publicado en** https://clippr-v2.sistemalety.workers.dev, plan gratis.
  Se pasa al plan de US$5/mes si la CPU por pedido no entra en los 10 ms del
  gratis, o con el primer cliente que pague. La cuota de 100.000
  pedidos/día del plan gratis es **por cuenta** y se comparte con el otro
  proyecto.
- **PWA:** la raíz `/` redirige a `/inicio` (antes mostraba la página del
  scaffolding y era lo que abría la app instalada) y el `start_url` del
  manifest apunta directo a `/inicio`.
- **Base de datos:** la misma de Supabase que se usó para desarrollar (un
  solo proyecto). Ver `docs/deuda-tecnica.md`.

### Campos de formulario con etiqueta flotante (implementado)

Elegidos en el Artifact "Campos de Clippr" (2026-10-03) entre seis estilos.

- `Input` (`src/components/ui/Input.tsx`): caja de 58 px, radio de 14 px,
  borde `--line-strong` (token nuevo) y, con foco, borde `accent-ink` con
  halo. El nombre del campo vive adentro y sube achicado cuando hay valor o
  foco, con `peer-placeholder-shown` / `peer-autofill` / `peer-focus` (el
  orden de esos variantes en el CSS compilado importa, y se verificó). Todo
  `Input` lleva un placeholder (un espacio si no se pasa uno); los ejemplos
  tipo "Ej. Juan Pérez" sólo aparecen al tocar el campo. Prop `prefix` para
  el "Gs." del monto.
- `Select` (`src/components/ui/Select.tsx`): la misma caja, etiqueta siempre
  arriba y flecha de lucide en vez de la nativa del teléfono.
- Login, registro, el monto de ingreso/egreso y los tres `<select>` sueltos
  (servicio en agenda, producto en caja, nivel del barbero) pasaron a estos
  componentes. El monto grande de "Abrir caja" (`OpenCashView`) no cambió.

### Poste de la racha (implementado)

Animación de la racha, elegida en dos Artifacts ("Animaciones de la racha"
y "Poste de la racha", 2026-10-03). Es la única parte de Clippr que rompe
el minimalismo a propósito. **Sin migraciones.**

- **`BarberPole`** (`src/components/ui/BarberPole.tsx` + CSS module): poste
  de barbería en CSS puro, sin librerías, en tres tamaños (`sm`/`md`/`lg`).
  Gira mientras la racha está viva (`activa`), se frena en el día de
  gracia (`en_peligro`) y queda gris si se apagó (`apagada`). `fast` es el
  giro rápido con brillo del momento de sumar un día. Tres niveles por días
  de racha: acero (0–6), oro (7–29, tapas y bola doradas) y encendido (30+,
  la bola se prende). Con "reducir movimiento" queda quieto.
- **Estado de la racha** (`streakStatus` en `src/lib/streaks.ts`): se deriva,
  no se guarda. `users.streak_count` sólo se recalcula al cerrar una caja,
  así que `getBarberStatsAction` busca la última caja cerrada con un cobro
  (`lastWorkedDate`, `src/lib/streak-days.ts`) y decide: hoy o ayer →
  activa; anteayer → en peligro (cerrar hoy todavía suma, misma regla que
  `nextStreakCount`); antes → apagada, y `streakCount` vuelve **0** aunque
  la base guarde el número viejo. Si esa consulta falla, la racha se
  muestra viva con el número guardado: el poste nunca alarma por un error
  de red.
- **/inicio:** `StreakTile` reemplaza al `StatTile` de la llama (poste chico
  al lado del número). En el día de gracia el cubo late en naranja
  (`--warning`, token nuevo) y aparece `StreakWarning` debajo de los cubos.
- **/estadisticas:** `StreakPanel`, cubo grande arriba de todo con el poste,
  el nombre del nivel, cuánto falta para el siguiente y la escalera de
  niveles. El chip de llama que estaba dentro del cubo del nivel se fue.
- **Cierre de caja:** `closeCashSessionAction` devuelve
  `{ session, streak: { previous, current } | null }` (null si la caja no
  tuvo cobros o la racha no se pudo guardar). Si subió, `CloseCashButton`
  la pasa a `useStreakCelebration` (Zustand, sin persistencia) y
  `StreakCelebration`, montada en `(dashboard)/layout.tsx`, sube una hoja con
  el poste girando rápido y el número nuevo cayendo como un sello. Vive en
  el layout porque `/caja` se vuelve a renderizar como "Abrir caja" apenas
  se cierra y el botón se desmonta.
- **Prueba:** Vitest (lógica pura, acciones con Supabase mockeado y los
  componentes con Testing Library: 263 tests) y capturas de los componentes
  reales en los dos temas con una página temporal, ya borrada. **No se
  probó con sesión iniciada** contra el proyecto real.

### Tema Recibo (fases 1 a 5 implementadas)

Spec 10 (`docs/specs/10-theme-recibo.md`): la app entera pasa al material
del ticket de papel térmico. Los colores salen del poste: blanco → papel,
azul → tinta, rojo → sello. Referencia visual: Artifact "Clippr en papel".
**Sin migraciones** en la fase 1.

- **Tokens** (`src/app/globals.css`): cambian los *valores* de los
  existentes (papel `#fffdf6` / carbón cálido `#161412`, cubos `#f4efe4` /
  `#211e1a`, tinta negra cálida), sin renombrar ninguno. Nuevos: `--stamp`
  (sólo sellos, nunca botones ni errores), y `--paper`, `--paper-ink`,
  `--paper-rule` para el ticket, que es un objeto y queda claro en los dos
  temas. Registrados en `@theme inline` (`bg-paper`, `text-stamp`, etc.).
  `THEME_BROWSER_COLOR` sigue a `--background`.
- **Tipografía:** IBM Plex Mono 500/600 (`next/font`, `--font-plex-mono` →
  `font-mono`) **sólo en montos y horas**, siempre con `tabular-nums`:
  listas de `/agenda`, `/caja`, "Lo que viene", precios de catálogo,
  cronómetro, KPIs de `/estadisticas` y los campos de monto/precio.
  `StatTile` suma la prop `mono`, que además deja partir "Gs." del número
  (ver `docs/decisiones.md`). Excepciones: el monto grande de abrir caja
  (`OpenCashView`) y el texto de las `<option>`, que siguen en Inter.
- **Horas en 24 h:** `formatBusinessTime`/`formatBusinessDateTime` fijan
  `hourCycle: "h23"`; `es-PY` daba "04:30 p. m." desde la spec 06, y el
  muestrario va en 24 h.
- **Punteado** (regla 3: sólo donde hay plata o se cuenta algo):
  `border-dashed border-muted/55` en las filas de `/agenda` y de los
  movimientos de `/caja`. El resto de las listas sigue con línea lisa.
- **`PerforatedBar`** (`src/components/ui/PerforatedBar.tsx`): barra de
  progreso perforada (segmentos de 5px, 3px de aire, sin redondeo) con la
  utilidad `perforated` de `globals.css` (`repeating-linear-gradient` sobre
  `currentColor`). Tonos `accent` y `on-accent`. La usan el nivel del
  barbero y el ranking del dueño.
- **"Iniciar corte"** sigue relleno (`bg-accent`), ahora como decisión
  explícita.
- **Prueba:** Vitest (323 tests). `src/app/__tests__/theme-tokens.test.ts`
  lee `globals.css` y verifica la tabla de la spec, el registro en
  `@theme inline`, `THEME_BROWSER_COLOR` y el contraste AA de los pares de
  texto en los dos temas (`--muted` sobre `--surface-2`: 4,81:1 claro,
  6,25:1 oscuro). Capturas a 360 px en los dos temas con Chromium headless
  sobre `/login` y una página temporal (ya borrada) que montaba los
  componentes reales con datos falsos. Después, recorrido con sesión de
  dueño contra el proyecto real (360 px, claro y oscuro): `/inicio`,
  `/agenda`, `/estadisticas`, `/servicios` y `/productos` sin desbordes ni
  errores de consola. Los movimientos de `/caja` (hacía falta abrir una
  caja) y la barra de nivel del barbero sólo se vieron con datos falsos.

#### Fase 2: el corazón temático

**Sin migraciones.**

- **Resumen del cierre en el servidor** (`src/lib/cash-summary.ts`,
  `summarizeCash`): función pura que separa cortes (`category =
  'service'`, cantidad y total), ventas (`'product'`), ingresos manuales y
  egresos, y da el saldo final. `computeSummary` en `cash.actions.ts`
  (reemplaza a `computeBalance`) la usa para **todo**: el saldo de `/caja`,
  el `final_balance` del cierre y el ticket. Así el TOTAL impreso es el
  mismo número que queda guardado por construcción.
  `closeCashSessionAction` devuelve `{ session, streak, summary,
  barberName }`.
- **`<Stamp />`** (`src/components/ui/Stamp.tsx`): sello en `--stamp`,
  mayúsculas, `sm` (−6°) y `md` (−8°), `double` para el doble borde. La
  animación (`animate-stamp-slam`, escala 2,6 → 0,92 → 1) se decide **al
  montar** con `useState`: cambiar la prop después no la repite. Usos:
  COBRADO (`/agenda`), AGOTADO (`/productos`), MEJOR DE HOY / DE LA SEMANA /
  DEL MES (primero del ranking del dueño) y la racha del cierre.
- **`<TicketReceipt />`** (`src/components/ticket/TicketReceipt.tsx`): sólo
  presentación; recibe `TicketLine[]` (`center` / `row` / `rule`) y un
  `footer`. Papel `--paper`, Courier Prime 11,5px con `preload: false` (se
  baja recién cuando aparece un ticket; verificado que en `/inicio` queda
  `unloaded`), punteado `--paper-rule` y zigzag con la clase `ticket-edge`
  de `globals.css` (dos gradientes, sin imágenes). Adentro redefine
  `--stamp` con `--paper-stamp` (`#b3261e` en los dos temas).
- **El cierre** (`src/components/ticket/CloseTicket.tsx`, montado en
  `(dashboard)/layout.tsx`) reemplaza a `StreakCelebration` (borrada): fondo
  `rgba(18,16,13,.76)`, boca de impresora, ticket que baja con
  `steps(14)` en 2s, sello de la racha a los 2,05s (poste chico de un color
  + "N DÍAS DE RACHA") y "Mañana va el N+1.", y "Listo" a los 2,5s. Sale en
  **todo** cierre; sin racha (`streak` null) sale sin sello. Los renglones
  los arma `closeTicketLines` (pura). El store pasó a
  `src/store/closeCelebrationStore.ts` (`useCloseCelebration`).
- **`/caja`**: los movimientos son un ticket sobre `--surface-2` con
  zigzag, en orden de llegada, "Saldo inicial" arriba y TOTAL = saldo del
  servidor. `getCashMovementsAction` devuelve `{ movements, hasMore }`
  (pide 9 para saber si hay más de 8); si hay más, en vez del saldo
  inicial va "Más movimientos antes". Los egresos van en tinta normal, no
  en `--danger`.
- **`/agenda`**: hora a la izquierda en mono, sello COBRADO bajo el monto
  (cae sólo si se cobra en pantalla), cancelados tachados y atenuados, y
  "Cancelar" / "Cobrar" como píldoras en el segundo renglón.
- **`/estadisticas`**: el número de racha del barbero en `--stamp`; sello
  en el primero del ranking del dueño.
- **`/equipo`**: subtítulo "Nivel · mail". El mail sale de `auth.users`
  con `getTeamEmailsAction` (clave de servicio) **sólo para el dueño**; a un
  barbero no se le muestran los mails del equipo.
- **`/mas`**: `BarbershopCard` arriba (poste, barbería, "Nombre · Rol",
  plan) con borde punteado; lee `users` + `barbershops` con RLS.
- **Login y registro**: `AuthShell` (poste, "Clippr", "Turnos, caja y racha
  de tu barbería" y el formulario en una tarjeta de papel con zigzag).
- **Prueba:** Vitest (402 tests; `next/font/google` mockeado en
  `vitest.setup.ts`). En el navegador, a 360 px y en los dos temas: con
  sesión de dueño, `/agenda` (7 sellos COBRADO quietos), `/productos`
  (AGOTADO), `/estadisticas` (MEJOR DE HOY), `/equipo` (mails reales) y
  `/mas` (tarjeta); login y registro; y con una página temporal (ya
  borrada) el ticket de `/caja` y la animación del cierre, con y sin
  racha, incluido el papel claro en tema oscuro.
- **Prueba contra la base real (2026-10-04):** con sesión de dueño, venta,
  egreso y walk-in en una caja abierta → ticket de `/caja` con TOTAL
  80.000 = saldo → cierre con la animación y el sello "2 DÍAS DE RACHA".
  Verificado en la base con un script de sólo lectura: `final_balance`
  80.000, `category` `product`/`manual`/`service` y `streak_count` 1 → 2.
  Una segunda caja el mismo día (ingreso manual, tema claro) imprime su
  ticket con "Otros ingresos" y `final_balance` 17.000, y la racha queda en
  2. Con sesión de barbero, `/estadisticas`: racha en `--stamp` y barra de
  nivel perforada. Sin errores de consola.

**Fase 3: compartir, sin señal y vibración (2026-10-04).** Una migración
(`20261004000000_barbershops_phone_owner_update.sql`, aplicada).

- **Teléfono de la barbería:** `barbershops.phone` (nullable, con `check`
  de formato). El dueño lo edita en línea en la tarjeta de `/mas`
  (`BarbershopPhone` → `updateBarbershopPhoneAction`, normalizado con
  `src/lib/phone.ts`). En la misma migración el `update` de `barbershops`
  quedó sólo para el dueño (`barbershops_update_owner` + `grant update
  (name, phone)`): nadie se cambia `subscription_plan` desde la consola.
- **Datos de la imagen:** `closeCashSessionAction` devuelve además
  `share: { barbershopName, phone, cutsByService } | null`
  (`readShareDay`): los cortes por servicio salen de los `appointments`
  `completed` del barbero dentro de la ventana de la caja
  (`countCutsByService`, `src/lib/share-day.ts`). Si falla, `share` es null
  y el ticket sale sin "Compartir"; el cierre nunca se cae por esto.
- **Compartir el día:** "Compartir" (contorno papel) junto a "Listo" en
  `CloseTicket` abre `ShareDayScreen` **encima** del ticket (al volver no se
  reimprime; Escape vuelve al ticket). Vista previa 9:16 de `ShareDayImage`
  (1080×1920, fondo carbón con rayas del poste, colores del papel fijos),
  renglones de `shareTicketLines` (barbería, día, barbero, `Servicio xN`,
  CORTES, sello de racha con `StreakStamp`, "Turnos: …", "Hecho con
  Clippr"). "Mostrar montos" arranca apagado cada vez y sólo agrega el
  TOTAL (`summary.finalBalance`). El PNG lo arma `html-to-image` en el
  teléfono con sólo dos fuentes (`share-fonts.ts`) y se comparte con
  `shareOrDownloadImage` (Web Share nivel 2; si no, descarga
  `clippr-AAAA-MM-DD.png`).
- **Sin señal (paso A):** `useOnline` (`src/lib/useOnline.ts`) +
  `OfflineNotice`. Deshabilitan el cobro en `FinishWalkinForm`,
  `FinishAppointmentForm` y `AppointmentRow`, y el cierre en
  `CloseCashButton`. Los temporizadores no dependen de la red.
- **Vibración:** `src/lib/haptics.ts` (`vibrate`, preferencia en
  `localStorage`), `<Stamp haptic>` en COBRADO, patrón de impresora en
  `CloseTicket`, `VibrationSwitch` en `/mas`.
- **Prueba:** Vitest (lint, typecheck, build). En el navegador contra la
  base real, con sesión de barbero: RLS de `barbershops` (`phone`/`name` →
  0 filas, `subscription_plan` → 403); sin señal simulado (cobro y cierre
  bloqueados con el aviso, cronómetro corriendo, cobro normal al volver);
  dos cierres con "Compartir": vista previa sin montos, con montos, día sin
  cortes, tema claro (la imagen no cambia) y el PNG real de 1080×1920
  interceptando `navigator.share`. Con sesión de dueño: teléfono guardado
  desde `/mas` (y uno inválido rechazado), `name`/`phone` → 1 fila,
  `subscription_plan` → 403. Pendiente: lo que sólo se puede en un Android
  real (ver `docs/deuda-tecnica.md`).

**Fase 4: vistas expandidas (2026-10-04).** Sin migraciones.

- **Pantallas vacías:** `BlankTicket` (`src/components/ticket/`, con la
  fuente compartida en `fonts.ts`) en `/agenda`, `/servicios`,
  `/productos`, `/equipo` y "Lo que viene" de `/inicio` (`tone="inset"`
  adentro del cubo). En `/caja` sin movimientos, una línea a máquina
  adentro del ticket.
- **Cierres de hoy (dueño):** `getTeamClosuresAction` (cajas cerradas del
  día por `start_time`, `summarizeCash` por caja) → `TeamClosures` en
  `OwnerDashboard`: un `TicketReceipt` por caja, en fila con scroll
  horizontal (`snap-x`, `scroll-px-4`).
- **Ticket del mes (barbero):** `getMonthTicketAction` (días 1 a 7, resumen
  del mes anterior con `summarizeMonth` de `src/lib/month-summary.ts`) →
  `MonthTicketCard` con `monthTicketLines`. "Compartir el mes" usa
  `ShareTicketScreen`, la pantalla de compartir generalizada
  (`ShareDayScreen` quedó como envoltorio; la imagen es `ShareImage`).
- **Tarjeta de sellos (barbero):** `getStampCardAction` (cajas cerradas con
  cobro desde 90 días antes del 1°) → `stampCardDays` y `streakByDay`
  (`src/lib/stamp-card.ts`) → `StampCard`: grilla lunes a domingo, sello
  quieto en cada día trabajado y `BarberPole` chico en los días 7 y 30 de la
  racha.
- **Prueba:** Vitest. En el navegador contra la base real con sesión de
  dueño: "Cierres de hoy" con los cinco cierres del día (TOTAL de cada uno
  igual a su `final_balance`), pantallas vacías a 360 px en los dos temas, y
  la tarjeta de sellos y el ticket del mes con los datos del dueño en una
  página temporal (ya borrada), más una tarjeta con datos falsos para ver el
  poste del día 30.

**Fase 5: ícono y pantalla de arranque (2026-10-04).** El poste sobre papel
en `public/icons/` (192 y 512 `any`, 512 `maskable`, `apple-touch-icon`
180×180), `background_color`/`theme_color` `#fffdf6` en
`public/manifest.json`, `icons` en la metadata de `src/app/layout.tsx` y
caché de una semana para `/icons/*` en `public/_headers`. SVG fuente en
`design/icono/`. Lo verifica `src/app/__tests__/pwa-manifest.test.ts`
(colores, propósitos y medidas reales de cada PNG). Sin imágenes de
arranque para iOS.

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
  - `id`, `cash_session_id`, `type` (income, expense), `category` (service,
    product, manual), `amount`, `description`, `created_at`
  - `category` (spec 09) es lo que permite un ticket promedio que no mezcle
    cortes con ventas de productos ni con propinas: antes eso se deducía del
    prefijo de `description`.

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
      /estadisticas   # Dashboards por rol y gamificación (implementado, spec 08)
  /components
    /ui               # Componentes base reutilizables (Button, Input, Select, Switch,
                      #   BottomNav, Tile — el cubo bento, ThemeSwitch — modo oscuro,
                      #   BarberPole — el poste de la racha)
    /forms            # useAmountInput.ts (monto con separador de miles, spec 07)
    /timers           # TimerList.tsx, TimerCard.tsx, FinishWalkinForm.tsx (spec 05),
                      #   FinishAppointmentForm.tsx y SinCajaAviso.tsx (2026-09-20)
    /streak           # StreakCelebration.tsx: la hoja del poste al cerrar la caja (2026-10-03)
  /lib
    /supabase         # Clientes de Supabase: client.ts (browser), server.ts (servidor), admin.ts (Service Role Key, solo servidor)
    utils.ts          # Funciones utilitarias generales (incluye formatGuaranies)
    dates.ts          # Fechas del negocio en America/Asuncion, incluido el formateo
                      #   para pantalla (+ dates.test.ts)
    theme.ts          # Cookie y tipo del tema claro/oscuro (2026-09-20)
    streaks.ts        # Reglas de la racha: día de gracia, estado y niveles del poste
    streak-days.ts    # Consultas de "qué días trabajó" para la racha (sólo servidor)
  /actions            # Server Actions — auth, service, product, team, cash, walkin, agenda (.actions.ts, implementados)
  /store              # Estado global del frontend (Zustand) — timerStore.ts (spec 05) y
                      #   streakCelebrationStore.ts (la hoja del poste, 2026-10-03)
  /types              # Definiciones de tipos e interfaces TypeScript

# Raíz: next.config.ts, tsconfig.json, eslint.config.mjs, vitest.config.ts,
#       vitest.setup.ts, postcss.config.mjs, .prettierrc.json, .env.example,
#       wrangler.jsonc y open-next.config.ts (deploy en Cloudflare)
```

`(auth)`, `(dashboard)/layout.tsx`, `(dashboard)/inicio`,
`(dashboard)/agenda`, `(dashboard)/servicios`, `(dashboard)/equipo`,
`(dashboard)/caja`, `(dashboard)/productos` y `(dashboard)/mas` ya tienen
lógica real — ver "Auth y Multi-Tenant", "Flujo de Walk-ins y
Temporizador", "Agenda de Turnos Programados", "Productos y Movimientos de
Caja", "Navegación Minimalista", "Sistema de Diseño", "Catálogo de
Servicios", "Gestión de Equipo" y "Sesión de Caja Diaria" más arriba.
`estadisticas/` también tiene lógica real desde la spec 08 — ver
"Estadísticas, Niveles y Rachas" más arriba. No quedan carpetas de
esqueleto sin implementar.

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
