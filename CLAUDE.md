# CLAUDE.md

Guía para trabajar en este repo. Escribí las respuestas y los comentarios de código en español (el equipo y los docs están en español).

## Qué es Clippr

App mobile-first / PWA para que barberos lleven registro de turnos, caja (ingresos/egresos) y estadísticas. Multi-tenant B2B2C: varias barberías, cada una con su equipo. Se monetiza como SaaS (planes trial / pro / team). Ver `docs/producto.md` y `docs/arquitectura.md` — **`docs/` es la fuente de verdad**; ante un conflicto entre un pedido y los docs, seguir el doc.

Esto es la **v2**, una reescritura. `docs/aprendizajes-v1.md` documenta qué falló en la v1 y no repetir.

## Stack

- **Next.js 15 App Router** + React 19 + TypeScript strict
- **Supabase** (Postgres + Auth + RLS) — clientes en `src/lib/supabase/`
- **Tailwind CSS v4** (config vía `@import "tailwindcss"` en `globals.css`, sin `tailwind.config`)
- **Zustand** para estado global del frontend (timers)
- **Vitest** + Testing Library para tests · **ESLint** (`next/core-web-vitals` + `next/typescript`) + Prettier

No hay backend Python. La lógica de servidor vive en Route Handlers y Server Actions de Next.

# Índice del proyecto

- docs/producto.md — qué es y qué NO hace
- docs/arquitectura.md — estado actual del diseño
- docs/decisiones.md — por qué cada cosa es así (leer antes de refactorizar)
- docs/backlog.md — qué falta

## Al empezar una sesión

Leé decisiones.md antes de proponer cambios estructurales.

## Al terminar una feature

Si tomaste una decisión de diseño no trivial, agregá una entrada
en decisiones.md antes del commit.

## Comandos

```bash
npm run dev        # dev server en http://localhost:3000
npm test           # Vitest, una pasada
npm run test:watch
npm run lint       # eslint .   (no usar `next lint`, deprecado en Next 16)
npm run typecheck  # tsc --noEmit
npm run format     # prettier --write . (docs/ está en .prettierignore)
npm run build
npm run preview    # build de Cloudflare (OpenNext) servido en local con wrangler
npm run deploy     # build de Cloudflare y publica el Worker clippr-v2
```

Correr `npm run lint && npm run typecheck && npm test` antes de dar una tarea por terminada. `.env.local` no hace falta para levantar el server ni el health check; sí para auth/datos (ver `.env.example`).

## Estructura

```
src/app/                 rutas (App Router)
  api/health/route.ts    health check (no toca DB ni auth)
  (auth)/                login/registro
  (dashboard)/           layout (guard de sesión + BottomNav) + inicio, caja,
                          agenda, servicios, productos, equipo, mas,
                          estadisticas
src/components/          ui/ (BottomNav, Tile — el cubo bento, ThemeSwitch, Input/Select,
                          BarberPole) · forms/ · timers/ · streak/ (hoja del poste)
src/lib/supabase/        client.ts (browser)  ·  server.ts (Server Components/Actions/Route Handlers)
src/lib/utils.ts         formatGuaranies, cn
src/lib/dates.ts         fechas del negocio en America/Asuncion — usar siempre esto, nunca new Date() pelado para "qué día es" ni un Intl.DateTimeFormat propio para mostrar una fecha
src/lib/theme.ts         cookie del tema claro/oscuro (la lee el layout raíz)
src/actions/             Server Actions — toda mutación sensible va acá
src/store/               Zustand (timerStore, streakCelebrationStore)
src/types/index.ts       tipos del modelo de datos
```

Alias de imports: `@/*` → `src/*`.

## Reglas de arquitectura (no negociables — vienen de los errores de v1)

1. **Lógica de negocio sensible sólo en el servidor.** Completar turnos, actualizar balance de caja y calcular rachas van en Server Actions (`src/actions/`), nunca calculado en el cliente. La v1 tuvo condiciones de carrera y manipulación de datos por hacer esto en el frontend.
2. **Aislamiento multi-tenant vía RLS de Supabase**, no con `WHERE barbershop_id = ...` a mano en cada query. Las políticas a nivel DB son la barrera.
3. **Timers = arreglo, no uno solo.** El `timerStore` debe soportar varios temporizadores concurrentes (ej. esperar un tinte mientras se atiende a otro cliente), con persistencia en `localStorage`. Sincronización con el servidor encolada al terminar un servicio.
4. **Tolerar internet inestable.** No depender de conexión constante (nada de Supabase Realtime para estado crítico de timers). El barbero tiene que poder seguir trabajando con la red caída.
5. **Nada de `if (DEMO)` intercalado en componentes.** Si hace falta modo demo, resolverlo con un patrón de repositorio/servicio que devuelva datos falsos según entorno.
6. **Planes y precios no hardcodeados** en el código.

## Modelo de datos

Entidades en `src/types/index.ts` y `docs/arquitectura.md`: `Barbershop`, `User` (role owner/barber/independent, level junior/pro/senior/elite, `commission_pct`, `streak_count`), `Product`, `Service`, `Appointment` (status scheduled/walkin/completed/cancelled), `CashSession` (una por barbero por día, status open/closed), `Transaction` (income/expense).

## Estado actual

Spec 01 (infra, auth, multi-tenant) implementada y probada end-to-end contra un
proyecto Supabase real: registro, login, logout, guard de sesión y RLS.
Ver `docs/arquitectura.md` sección "Auth y Multi-Tenant" y `docs/decisiones.md`.

Spec 02 (catálogo de servicios, CRUD en `/servicios`) implementada y probada
con Vitest (mocks de Supabase) y de punta a punta en el navegador contra el
proyecto real, incluyendo aislamiento de tenant con dos barberías. Activar/
Desactivar un servicio es un switch optimista (`useOptimistic`), no un
borrado. Ver `docs/arquitectura.md` sección "Catálogo de Servicios" y
`docs/decisiones.md`.

Spec 03 (gestión de equipo, alta de barberos en `/equipo`) implementada y
probada con Vitest (mocks de Supabase, incluyendo control de acceso por
rol). Sin migraciones nuevas. No se corrió de punta a punta contra el
proyecto real (crear un barbero real y loguearse con esa cuenta) en esta
sesión. Ver `docs/arquitectura.md` sección "Gestión de Equipo" y
`docs/decisiones.md`.

Spec 04 (sesión de caja diaria, apertura/cierre en `/caja`) implementada y
probada con Vitest (mocks de Supabase) y de punta a punta en el navegador
contra el proyecto real, incluyendo bloqueo de doble caja y aislamiento
entre barberos y entre barberías. Migración
(`20260915000000_create_cash_sessions_table.sql`, tabla `cash_sessions` +
función `current_user_id()`) aplicada. Desde el sprint de estabilización
(2026-09-16), `/caja` muestra el saldo actual (inicial + cobros −
egresos) y el cierre guarda ese mismo número como `final_balance`.
Ver `docs/arquitectura.md` sección "Sesión de Caja Diaria" y
`docs/decisiones.md`.

Spec 05 (flujo de walk-ins y temporizador, `/inicio`) implementada y
probada con Vitest (mocks de Supabase) y de punta a punta en el navegador
contra el proyecto real: crear servicio, abrir caja, iniciar un
temporizador, sobrevivir a un F5 con el tiempo corriendo (persistencia de
Zustand), finalizar y cobrar (verificado el `appointment` y la
`transaction` resultantes directo contra la base), y el bloqueo de cobro
sin caja abierta. Migración
(`20260916000000_create_appointments_and_transactions.sql`, tablas
`appointments` y `transactions`) aplicada. La pantalla principal del
barbero quedó en `/inicio` (no en `/agenda`, reservado para la spec 06) y
el redirect post-login/registro se actualizó a esa ruta. RLS de
`appointments`/`transactions` sigue el mismo criterio estricto que
`cash_sessions` (ni el dueño ve lo ajeno todavía). Ver
`docs/arquitectura.md` sección "Flujo de Walk-ins y Temporizador" y
`docs/decisiones.md`.

Spec 05.5 (navegación minimalista) implementada y probada en el navegador
contra el proyecto real: barra de navegación inferior fija con 4 íconos
(`lucide-react`) — Inicio, Caja, Agenda, Más — y `(dashboard)/mas` con
los links a Servicios/Equipo y Cerrar sesión. Ver `docs/arquitectura.md`
sección "Navegación Minimalista" y `docs/decisiones.md`.

Refinamiento de dirección visual (2026-09-15, no es una spec nueva del
backlog) probado en el navegador contra el proyecto real: tipografía
única (`Inter`, reemplaza `Zilla Slab` + `Work Sans`), trazo fino en los
íconos de `BottomNav` (1.5/2.25), sistema de botones con jerarquía
primary/secondary/ghost/danger y `active:scale-95` en `Button.tsx`
(incluye el fix de los submits de login/registro que seguían en
`bg-black`), y rediseño de `(dashboard)/layout.tsx` + `/inicio`: sin
barra superior, cabecera "Hola, {nombre}" con píldoras monocromas sin
números, y un botón "Iniciar corte" de ancho completo con estilo
contorno. Explorado primero en un Artifact ("Muestrario Clippr") antes
de tocar código. Quedaron pendientes de confirmación cuatro
inconsistencias chicas en `/equipo` (casing de botón, "Correo" vs
"Email", 0% de comisión mostrado para el dueño, `text-red-600` suelto) —
ver `docs/deuda-tecnica.md`. Ver `docs/arquitectura.md` sección "Sistema
de Diseño" y `docs/decisiones.md`.

Spec 06 (agenda de turnos programados, `/agenda`) implementada y probada
con Vitest (mocks de Supabase): agendar un turno (in-line, sin modal),
completarlo/cobrarlo (mismos principios que el walk-in de la spec 05:
precio y `end_time` del servidor, bloqueo sin caja abierta) y cancelarlo,
con `useOptimistic` por fila y navegación de fecha vía `?date=` en la URL.
La spec no cerraba sola: faltaba la política RLS de `update` sobre
`appointments` (la spec 05 solo había creado `select`/`insert`, porque el
walk-in nunca actualiza un turno ya insertado) — se agregó
`appointments_update_own` (migración
`20260916010000_appointments_update_own.sql`) con el mismo criterio
estricto que el resto de `appointments`. Migración aplicada contra el
proyecto real (`supabase db push`, confirmado por el usuario tras
consultarle porque la spec no cerraba sola). Probado además de punta a
punta en el navegador contra el proyecto real (agendar, bloqueo de cobro
sin caja, navegar días, cancelar, cobrar y verificar la `transaction` en
la base). Esa prueba encontró dos bugs que se corrigieron en el sprint de
estabilización del mismo día: las fechas del negocio ahora se resuelven
en `America/Asuncion` (`src/lib/dates.ts`) y cobrar antes de hora corre
`start_time` para que la duración no quede negativa (los turnos de días
futuros no se pueden cobrar). En el mismo sprint `/caja` pasó a mostrar
el saldo actual y el cierre a guardarlo como `final_balance`. Los tres
arreglos se volvieron a probar en el navegador contra el proyecto real
(turno de 21:30 en el día correcto, cobro anticipado con duración de 30
min, cobro de un turno de mañana rechazado, saldo 50.000 + 30.000 =
80.000 en pantalla y en `final_balance`). Ver `docs/arquitectura.md`
sección "Agenda de Turnos Programados" y `docs/decisiones.md`.

Spec 07 (productos y movimientos de caja) implementada y probada con
Vitest (mocks de Supabase) y de punta a punta en el navegador contra el
proyecto real con una cuenta de dueño (catálogo, egreso/ingreso manual,
venta con y sin stock, verificado en la base), más las RLS nuevas con
scripts descartables. También probada con una cuenta de barbero (sin
controles de catálogo, acciones del catálogo rechazadas aunque se llamen
directo, venta desde su propia caja). `/productos` (catálogo con stock; solo el dueño crea, edita
y activa/desactiva, validado en el Server Action) con link desde `/mas`.
En `/caja`, sección "Movimientos": ingreso/egreso manual y venta de
producto, las dos resuelven la caja abierta en el servidor. La venta
descuenta stock con un update condicionado al stock leído (sin RPC
atómico, ver `docs/deuda-tecnica.md`). Dos migraciones aplicadas:
`20260916020000_create_products_table.sql` y
`20260916030000_transactions_insert_open_session_only.sql` (RLS de
`transactions` ahora exige caja `open`, a pedido del usuario porque la
spec asumía que ya lo hacía). La lógica del monto con separador de miles
de `OpenCashView` pasó a `src/components/forms/useAmountInput.ts`. Ver
`docs/arquitectura.md` sección "Productos y Movimientos de Caja" y
`docs/decisiones.md`.

Contraseñas de barberos (2026-09-16, no es una spec del backlog): el alta
en `/equipo` genera una contraseña temporal aleatoria (`src/lib/passwords.ts`)
que se muestra una sola vez al dueño, en vez de la fija `Clippr2026!`, y
`/mas/cambiar-password` permite cambiarla (opcional, pide la actual). Sin
cambio forzado ni recuperación por email (Fase 2). Ver `docs/decisiones.md`.

Spec 08 (estadísticas, niveles y rachas) implementada y probada con Vitest
(mocks de Supabase) y de punta a punta en el navegador contra el proyecto
real, con una cuenta de barbero y una de dueño de la misma barbería.
`/estadisticas` decide por rol: el dueño ve KPIs de la
barbería (ingresos, cortes, promedio diario, ticket promedio) con filtros
Hoy/Semana/Mes vía `?rango=` y un leaderboard del equipo; el barbero ve su
día, su racha y una barra de progreso de nivel. Las píldoras de `/inicio`
dejaron de ser estáticas y `Estadísticas` se sumó a `/mas` (la BottomNav
sigue con 4 íconos). Dos reglas que la spec dejaba abiertas se definieron con
el usuario: el **nivel es una liga de 30 días móviles** (junior <40, pro
40–90, senior 91–150, élite 151+, puede bajar; `src/lib/levels.ts`) y la
**racha tolera un día de gracia** (0 días sin cambio, 1–2 días +1, 3+ vuelve
a 1; `src/lib/streaks.ts`). Las dos se recalculan en
`updateStreakAndLevel`, dentro de `closeCashSessionAction`, después del
cierre: si falla, se loguea y la caja igual queda cerrada.
Migración `20260917000000_owner_stats_visibility.sql` (función
`current_user_role()` + `select` de `cash_sessions`/`appointments`/
`transactions` abierto al dueño de la barbería) aplicada con
`supabase db push` y verificada en el navegador: el dueño ve el leaderboard
con los cortes y los ingresos de su barbero, que antes de la migración le
estaban tapados. Ojo: al aflojar esas policies, `getAgendaAction` pasó a
filtrar `user_id` a mano — ninguna consulta puede seguir asumiendo que RLS
la acota a lo propio sobre esas tres tablas (verificado: la agenda del dueño
sigue vacía aunque su barbero tenga turnos ese día). Ver
`docs/arquitectura.md` sección "Estadísticas, Niveles y Rachas",
`docs/decisiones.md` y `docs/deuda-tecnica.md`.

Spec 09 (estabilización, seguridad y pulido) implementada en sus pasos 1 a 4
y probada con Vitest (mocks de Supabase, 183 tests). Las **cuatro**
migraciones nuevas están **aplicadas** contra el proyecto real
(`supabase db push`, 2026-09-20) y probada de punta a punta en el navegador
con una cuenta de dueño: walk-in, turno de agenda, venta de producto (con y
sin stock), movimiento manual, cierre de caja con racha 0 → 1, ticket
promedio y los fixes de `/equipo`. Cero errores de servidor y de consola.
Ver `docs/arquitectura.md` sección "Estabilización, Seguridad y Pulido",
subsección "Prueba de punta a punta". Qué cambió:

- **Cobros atómicos** (`20260920000000_atomic_charge_rpcs.sql`): tres
  funciones `SECURITY DEFINER` (`complete_walkin_and_charge`,
  `complete_appointment_and_charge`, `sell_product_and_charge`) hacen todas
  las escrituras de un cobro en una sola transacción. `completeWalkinAction`,
  `completeScheduledAppointmentAction` y `sellProductAction` quedaron en una
  llamada `.rpc(...)`. El monto lo lee la base, nunca viaja como parámetro.
  Los errores de negocio vuelven como SQLSTATE de la clase `CL`
  (`src/lib/db-errors.ts`).
- **`users` cerrado** (`20260920010000_users_update_hardening.sql`): un
  barbero ya no puede inflarse `streak_count` ni `level` desde la consola.
  Policy de fila propia + `grant update (name)` (una policy no puede mirar
  qué columna cambió) + `update_team_member` para el dueño y `service_role`
  para la racha. **Ojo:** el cierre de caja ahora depende de
  `SUPABASE_SERVICE_ROLE_KEY` para guardar racha/nivel; si falta, el cierre
  igual funciona (try/catch) pero la gamificación no se actualiza.
- **`transactions.category`** (`20260920020000_transactions_category.sql`):
  `service`/`product`/`manual`. El ticket promedio del dueño dejó de mezclar
  cortes con ventas.
- **Pulido:** `/agenda` sin "Cobrar" en días futuros (el servidor decide si
  el día es futuro y lo baja como prop), y los cuatro fixes de `/equipo` que
  estaban pendientes desde el 2026-09-15.
- **`20260920030000_revoke_rpc_from_anon.sql`:** en Supabase,
  `revoke execute ... from public` **no** deja afuera a `anon` — hay un
  `alter default privileges` que le da un grant explícito a cada función
  nueva. Regla para cualquier función futura: revocarle a `anon` a mano. Ver
  `docs/decisiones.md` 2026-09-20.

El **paso 5 de la spec 09** (tests E2E de RLS automatizados) quedó fuera a
propósito: no hay entorno de base donde correrlos sin ensuciar producción.
El plan está escrito en `docs/deuda-tecnica.md`.

Ver `docs/arquitectura.md` sección "Estabilización, Seguridad y Pulido" y
`docs/decisiones.md` (2026-09-20).

Bento UI y modo oscuro (2026-09-20, no es una spec del backlog):
`/inicio`, `/caja` y `/estadisticas` pasaron a una grilla de cubos
(`src/components/ui/Tile.tsx`: `Tile`, `StatTile`, `tileClasses`, más el
token `--radius-tile`), con **un solo cubo relleno por pantalla**. El
glassmorphism se exploró y se descartó por el costo de `backdrop-filter`
en gama media. Cambios de contenido pedidos por el usuario: en `/inicio`
la racha y los cortes van **arriba** de "Iniciar corte" (dos cubos
compactos — cuadrados se comían media pantalla), la **caja sale** de esa
pantalla, abajo aparecen los turnos agendados del día
(`UpcomingAppointments`) y el **nivel se queda en `/estadisticas`**. `/caja` suma tres cubos de acción
(Ingreso · Egreso · Vender) que abren en línea los formularios de la spec
07 —ahora controlados— y la lista de movimientos del día
(`getCashMovementsAction`, dato nuevo, **sin migración**).

El **modo oscuro** reemplaza la decisión del 2026-09-14 ("tema fijo
claro"): dos temas por `data-theme` en el `<html>`, switch en `/mas`,
preferencia en la cookie `clippr-theme` que **lee el servidor** en
`layout.tsx` (sin parpadeo ni desajuste de hidratación). El acento se
partió en `--accent` (relleno), `--accent-contrast` (texto sobre el
relleno) y `--accent-ink` (acento como texto), y se sumó `--success`:
**ningún componente nuevo debe usar `text-white` sobre `bg-accent` ni
`text-accent` como color de texto.** Verificado: lint, typecheck, 203
tests, `npm run build` con las 14 rutas, y el mecanismo del tema contra el
server de producción (cookie → `data-theme` → `theme-color` → CSS).
**Pendiente:** el recorrido visual de las pantallas autenticadas en los
dos temas, que necesita una sesión iniciada en el navegador. Ver
`docs/arquitectura.md` sección "Bento UI y Modo Oscuro" y
`docs/decisiones.md` (2026-09-20).

Empezar un turno agendado desde `/inicio` (2026-09-20, no es una spec del
backlog): cerró un hueco de modelo, no sólo de UI — **un turno agendado no
se podía cronometrar**, el temporizador era sólo para el cliente de paso.
Ahora `Timer` tiene `appointmentId`/`serviceId` opcionales (**sin
`appointmentId` es un walk-in**, igual que antes, sin migrar el
`localStorage`), el botón "Empezar" en la fila de `/inicio` arranca el
contador, el turno desaparece de "Lo que viene" y se cobra desde la tarjeta
con `completeScheduledAppointmentAction` — el RPC de la spec 09 sin tocar.
**Sin migraciones.** Empezar no exige caja abierta (es estado local, regla
4); cobrar sí.

Tres cosas para tener presentes: (1) las tres acciones de
`agenda.actions.ts` **no revalidaban `/inicio`** y por eso un turno recién
agendado podía no aparecer ahí — arreglado; (2) **`useTimerStore.persist` no
existe en el servidor** (sin `localStorage`, Zustand devuelve el store sin
la API de persistencia), así que leerlo durante el render tumba la pantalla
con un 500 — pasó, va con `?.` y tiene test; (3) el turno guarda la hora
**agendada**, no la del cronómetro, así que las duraciones difieren (ver
`docs/deuda-tecnica.md`). Verificado: lint, typecheck, 223 tests y `/inicio`
sirviendo 200 sin errores. **Pendiente:** el recorrido a mano del flujo
completo con sesión iniciada. Ver `docs/arquitectura.md` sección "Empezar un
turno desde /inicio" y `docs/decisiones.md` (2026-09-20).

Hosting, campos y poste de la racha (2026-10-03, no son specs del
backlog):

- **Deploy en Cloudflare Workers** con OpenNext (`wrangler.jsonc`, Worker
  `clippr-v2`, `npm run deploy`), plan gratis para probar. Publicado en
  https://clippr-v2.sistemalety.workers.dev. `SUPABASE_SERVICE_ROLE_KEY` va
  como secreto del Worker (`wrangler secret put`), en local en `.dev.vars`.
  La raíz `/` redirige a `/inicio` y el `start_url` de la PWA también. Ver
  `docs/decisiones.md` (Cloudflare en vez de Vercel).
- **Campos con etiqueta flotante:** `Input` y `Select` nuevos en
  `src/components/ui/`, token `--line-strong`. Login, registro y los tres
  `<select>` sueltos pasaron a estos componentes.
- **Poste de la racha:** `BarberPole` en /inicio (`StreakTile`),
  /estadisticas (`StreakPanel`) y la hoja al cerrar la caja
  (`StreakCelebration` en el layout). `closeCashSessionAction` ahora
  devuelve `{ session, streak }`. El estado de la racha (viva / en peligro /
  apagada) se deriva en `getBarberStatsAction`; con la racha apagada,
  `streakCount` vuelve 0. Token `--warning`. **Sin migraciones.**
  Verificado: lint, typecheck, 263 tests, build y capturas de los
  componentes en los dos temas. **Pendiente:** verlo con sesión iniciada.
  Ver `docs/arquitectura.md` sección "Poste de la racha".

Spec 10 (tema "Recibo de Barbería", `docs/specs/10-theme-recibo.md`),
**fase 1 implementada** (2026-10-03): tokens con la paleta papel/tinta/sello
(`--stamp`, `--paper*` nuevos, ningún token renombrado), `theme-color`
`#fffdf6`/`#161412`, IBM Plex Mono como `font-mono` **sólo en montos y
horas**, punteado en las filas de `/agenda` y de movimientos de `/caja`,
`PerforatedBar` en las barras de progreso y "Iniciar corte" relleno ya
registrado como decisión. Las horas pasan de 12 h ("04:30 p. m.") a
24 h como en el muestrario (`hourCycle: "h23"` en `src/lib/dates.ts`). **Sin migraciones.**
Verificado: lint, typecheck, 323 tests (incluye un test que lee
`globals.css` y chequea la tabla de la spec y el contraste AA en los dos
temas), build y capturas a 360 px en los dos temas con Chromium headless.
Recorrido con sesión de dueño en el navegador (360 px, claro y oscuro):
`/inicio`, `/agenda`, `/estadisticas`, `/servicios`, `/productos`, sin
desbordes ni errores de consola. Movimientos de `/caja` y barra de nivel
del barbero sólo vistos con datos falsos. **Pendiente:** fases 2 a 5. Ver
`docs/arquitectura.md` sección "Tema Recibo".

El resto (nada pendiente del backlog) sigue como estaba.
