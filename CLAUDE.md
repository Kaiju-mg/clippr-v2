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
  (dashboard)/           layout + agenda, caja, estadisticas
src/components/          ui/ · forms/ · timers/
src/lib/supabase/        client.ts (browser)  ·  server.ts (Server Components/Actions/Route Handlers)
src/lib/utils.ts
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
función `current_user_id()`) aplicada. `final_balance` por ahora iguala a
`initial_balance` (no hay turnos/cobros que sumar — spec futura). Ver
`docs/arquitectura.md` sección "Sesión de Caja Diaria" y `docs/decisiones.md`.

El resto (agenda, estadísticas) sigue siendo esqueleto sin lógica.
