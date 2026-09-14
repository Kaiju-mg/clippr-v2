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
- **Páginas:** `(auth)/login`, `(auth)/registro` (formularios controlados, sin librería de forms) y `(dashboard)/layout.tsx` (guard de sesión server-side vía `supabase.auth.getUser()` + navbar con el nombre de la barbería y logout). Tras login/registro exitoso se redirige a `/agenda`, que por ahora es un placeholder (la lógica de turnos es de una spec futura).
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
  acento "Tinta" (`#1f3a5f`), tipografías `Zilla Slab` + `Work Sans` vía
  `next/font/google`. Tokens en `src/app/globals.css`. Ver `decisiones.md`
  2026-09-14.

## Modelo de Datos

Entidades principales enfocadas en resolver el modelo Multi-Tenant, los turnos y la gestión individual de caja:

- **Barbershop (Barbería):**
  - `id`, `name`, `subscription_plan` (trial, pro, team), `created_at`
- **User (Usuario - Dueño/Barbero/Independiente):**
  - `id`, `auth_id` (vinculado a Supabase Auth), `barbershop_id`, `role` (owner, barber, independent), `name`, `level` (junior, pro, senior, elite), `commission_pct`, `streak_count`
- **Product (Producto / Stock):**
  - `id`, `barbershop_id`, `name`, `price`, `stock`, `low_stock_threshold`
- **Service (Servicio ofrecido):**
  - `id`, `barbershop_id`, `name`, `price` (entero, guaraníes sin
    decimales), `duration_minutes`, `is_active` (activar/desactivar
    reversible desde la UI, no borrado — ver `decisiones.md`)
- **Appointment (Turno / Corte):**
  - `id`, `barbershop_id`, `user_id` (barbero asignado), `client_name`, `service_id`, `start_time`, `end_time`, `status` (scheduled, walkin, completed, cancelled)
- **CashSession (Sesión de Caja Diaria por Barbero):**
  - `id`, `user_id`, `start_time`, `end_time`, `initial_balance`, `final_balance`, `status` (open, closed)
  - `end_time` y `final_balance` son `null` mientras `status` = `open`.
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
    /(dashboard)      # Layout (guard de sesión + navbar, implementado)
      /agenda         # Placeholder — vista y gestión de turnos (spec futura)
      /servicios      # Catálogo de servicios (implementado, spec 02)
      /caja           # Gestión de CashSessions individuales (vacío, .gitkeep)
      /estadisticas   # Reportes e insights (vacío, .gitkeep)
  /components
    /ui               # Componentes base reutilizables (Button, Input, Switch)
    /forms            # Formularios de la aplicación
    /timers           # Lógica visual de los temporizadores
  /lib
    /supabase         # Clientes de Supabase: client.ts (browser), server.ts (servidor)
    utils.ts          # Funciones utilitarias generales (incluye formatGuaranies)
  /actions            # Server Actions — auth.actions.ts, service.actions.ts (implementados)
  /store              # Estado global del frontend (Zustand - ej. timerStore)
  /types              # Definiciones de tipos e interfaces TypeScript

# Raíz: next.config.ts, tsconfig.json, eslint.config.mjs, vitest.config.ts,
#       vitest.setup.ts, postcss.config.mjs, .prettierrc.json, .env.example
```

`(auth)`, `(dashboard)/layout.tsx`, `(dashboard)/servicios` ya tienen lógica
real — ver "Auth y Multi-Tenant" y "Catálogo de Servicios" más arriba.
`(dashboard)/agenda` sigue siendo un placeholder (spec futura). `caja/`,
`estadisticas/`, `forms/`, `timers/`, `store/` siguen vacíos (`.gitkeep`):
son el esqueleto para las próximas specs.

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
