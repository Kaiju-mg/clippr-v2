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
```

Correr `npm run lint && npm run typecheck && npm test` antes de dar una tarea por terminada. `.env.local` no hace falta para levantar el server ni el health check; sí para auth/datos (ver `.env.example`).

## Estructura

```
src/app/                 rutas (App Router)
  api/health/route.ts    health check (no toca DB ni auth)
  (auth)/                login/registro
  (dashboard)/           layout (guard de sesión + BottomNav) + inicio, caja,
                          agenda, servicios, productos, equipo, mas,
                          estadisticas (vacío)
src/components/          ui/ (incluye BottomNav) · forms/ · timers/
src/lib/supabase/        client.ts (browser)  ·  server.ts (Server Components/Actions/Route Handlers)
src/lib/utils.ts         formatGuaranies, cn
src/lib/dates.ts         fechas del negocio en America/Asuncion — usar siempre esto, nunca new Date() pelado para "qué día es"
src/actions/             Server Actions — toda mutación sensible va acá
src/store/               Zustand (timerStore)
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
(mocks de Supabase). `/estadisticas` decide por rol: el dueño ve KPIs de la
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
`transactions` abierto al dueño de la barbería) **escrita pero NO aplicada
todavía** con `supabase db push`, y `/estadisticas` no se probó en el
navegador contra el proyecto real. Ojo: al aflojar esas policies,
`getAgendaAction` pasó a filtrar `user_id` a mano — ninguna consulta puede
seguir asumiendo que RLS la acota a lo propio sobre esas tres tablas. Ver
`docs/arquitectura.md` sección "Estadísticas, Niveles y Rachas",
`docs/decisiones.md` y `docs/deuda-tecnica.md`.

El resto (nada pendiente del backlog) sigue como estaba.
