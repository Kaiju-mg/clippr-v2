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
| `npm run preview`    | Build de Cloudflare y lo sirve en local       |
| `npm run deploy`     | Build de Cloudflare y lo publica              |

## Deploy

La app corre en **Cloudflare Workers** con el adaptador [OpenNext](https://opennext.js.org/cloudflare) (`wrangler.jsonc`, Worker `clippr-v2`). Ver `docs/decisiones.md` (2026-10-03) por qué no Vercel.

```bash
npx wrangler login                                  # una vez, abre el navegador
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # una vez por Worker
npm run deploy                                      # compila y publica
```

- Las `NEXT_PUBLIC_*` se incrustan al compilar: salen de `.env.local`.
- `SUPABASE_SERVICE_ROLE_KEY` va como secreto del Worker; en local, para `npm run preview`, en `.dev.vars` (ignorado por git, mismo formato que `.env.local`).
- OpenNext avisa que en Windows no es del todo compatible y recomienda WSL. Hasta ahora compila y publica bien desde Windows.
- Si un servidor local (`wrangler dev` o `next dev`) queda colgado, el build falla con `EPERM` al borrar `.open-next/`: cerrar esos procesos y reintentar.

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
    (dashboard)/       # inicio, agenda, caja, servicios, productos, equipo, mas, estadisticas
  components/          # ui (incluye Input/Select y BarberPole), forms, timers, streak
  lib/supabase/        # clientes browser, server y admin
  lib/utils.ts         # formatGuaranies, cn
  lib/dates.ts         # fechas del negocio en America/Asuncion
  lib/streaks.ts       # reglas de la racha (día de gracia, estado y niveles del poste)
  actions/             # Server Actions (auth, servicios, productos, equipo, caja, walk-ins, agenda, estadísticas)
  store/               # Estado global (Zustand: timers y la hoja del poste)
  types/               # Tipos del dominio
supabase/migrations/   # SQL versionado (schema + RLS), aplicar con `supabase db push`
```
