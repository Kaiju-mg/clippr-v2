# Clippr v2

Gestión de turnos y caja para barberías. Stack: **Next.js (App Router) + Supabase + Tailwind CSS**, mobile-first / PWA. Ver [`docs/arquitectura.md`](docs/arquitectura.md).

## Requisitos

- Node.js >= 20.9 (`.nvmrc` fija la 22)

## Setup

```bash
npm install
cp .env.example .env.local   # completar con credenciales de Supabase
```

Las variables de Supabase no son necesarias para levantar el server ni para el health check; sí para auth y datos (login, caja, agenda, etc.).

## Scripts

| Comando              | Qué hace                                      |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Server de desarrollo en http://localhost:3000 |
| `npm run build`      | Build de producción                           |
| `npm start`          | Sirve el build                                |
| `npm test`           | Corre los tests (Vitest, una pasada)          |
| `npm run test:watch` | Tests en watch mode                           |
| `npm run lint`       | ESLint (config de Next + Prettier)            |
| `npm run format`     | Formatea con Prettier                         |
| `npm run typecheck`  | `tsc --noEmit`                                |

## Health check

```bash
curl http://localhost:3000/api/health
# {"status":"ok","service":"clippr-v2","timestamp":"..."}
```

## Estructura

```text
src/
  app/                 # Rutas (App Router)
    api/health/        # Health check
    (auth)/            # Login/registro
    (dashboard)/       # inicio, agenda, caja, servicios, equipo, mas, estadisticas (vacío)
  components/          # ui, forms, timers
  lib/supabase/        # clientes browser, server y admin
  lib/utils.ts         # formatGuaranies, cn
  lib/dates.ts         # fechas del negocio en America/Asuncion
  actions/             # Server Actions (lógica de negocio: auth, servicios, equipo, caja, walk-ins, agenda)
  store/               # Estado global (Zustand: timers)
  types/               # Tipos del dominio
supabase/migrations/   # SQL versionado (schema + RLS), aplicar con `supabase db push`
```
