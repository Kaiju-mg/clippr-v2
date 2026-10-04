# Clippr v2

Turnos, caja y racha para barberías. App mobile-first / PWA multi-tenant: cada barbería tiene su equipo (dueño y barberos), su agenda, su caja diaria y sus estadísticas. Stack: **Next.js 15 (App Router) + Supabase (Postgres, Auth, RLS) + Tailwind CSS v4**, publicada en **Cloudflare Workers**.

Documentación:

| Documento                                        | Para qué                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| [`docs/producto.md`](docs/producto.md)           | Qué es y qué no hace                                             |
| [`docs/arquitectura.md`](docs/arquitectura.md)   | Cómo está armado, pantalla por pantalla                          |
| [`docs/decisiones.md`](docs/decisiones.md)       | Por qué cada cosa es así (leer antes de refactorizar)            |
| [`docs/deuda-tecnica.md`](docs/deuda-tecnica.md) | Lo que falta o hay que mejorar                                   |
| [`docs/produccion.md`](docs/produccion.md)       | Separar la base de producción, respaldos, CPU en Cloudflare, Git |
| [`docs/specs/`](docs/specs)                      | Las especificaciones de cada etapa                               |
| [`CLAUDE.md`](CLAUDE.md)                         | Reglas para trabajar en el repo (también para la IA)             |
| [`CHANGELOG.md`](CHANGELOG.md)                   | Historial de cambios                                             |

## Requisitos

- Node.js >= 20.9 (`.nvmrc` fija la 22)
- Un proyecto de [Supabase](https://supabase.com) para auth y datos

## Setup

```bash
npm install
cp .env.example .env.local   # completar con las credenciales de Supabase
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push         # aplica las migraciones de supabase/migrations/
npm run dev                  # http://localhost:3000
```

Las variables de Supabase no hacen falta para levantar el server ni para el health check; sí para todo lo demás.

### Variables de entorno

| Variable                        | Dónde se usa       | Notas                                                                                                                                                |
| ------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Cliente y servidor | Se **graba al compilar**. Pública                                                                                                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente y servidor | Se **graba al compilar**. Pública: lo que protege los datos es RLS                                                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Sólo servidor      | Secreta. Alta de barberos, racha/nivel al cerrar caja, mails del equipo, teléfono y eliminar cuenta. Sin ella esas funciones degradan con un mensaje |

En local van en `.env.local` (y `SUPABASE_SERVICE_ROLE_KEY` también en `.dev.vars` para `npm run preview`). Ninguno de los dos se sube a git. Para producción ver [`docs/produccion.md`](docs/produccion.md): la base de producción todavía es la de desarrollo.

## Scripts

| Comando              | Qué hace                                            |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Server de desarrollo en http://localhost:3000       |
| `npm test`           | Tests (Vitest, una pasada)                          |
| `npm run test:watch` | Tests en watch mode                                 |
| `npm run lint`       | ESLint (config de Next + Prettier)                  |
| `npm run typecheck`  | `tsc --noEmit`                                      |
| `npm run format`     | Formatea con Prettier (`docs/` está excluido)       |
| `npm run build`      | Build de producción de Next                         |
| `npm run preview`    | Build de Cloudflare servido en local con wrangler   |
| `npm run deploy`     | Build de Cloudflare y publica el Worker `clippr-v2` |

Antes de dar una tarea por terminada: `npm run lint && npm run typecheck && npm test`. No correr `npm run build` con `npm run dev` levantado: los dos escriben en `.next`.

## Deploy

La app corre en **Cloudflare Workers** con [OpenNext](https://opennext.js.org/cloudflare) (`wrangler.jsonc`, Worker `clippr-v2`). Ver `docs/decisiones.md` (2026-10-03) por qué no Vercel, y [`docs/produccion.md`](docs/produccion.md) antes del piloto.

```bash
npx wrangler login                                  # una vez, abre el navegador
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # una vez por Worker
npm run deploy                                      # compila y publica
```

- OpenNext avisa que en Windows no es del todo compatible y recomienda WSL. Hasta ahora compila y publica bien desde Windows.
- Si un servidor local queda colgado, el build falla con `EPERM` al borrar `.open-next/`: cerrar esos procesos y reintentar.

## API

Clippr no expone una API pública. Todo lo que cambia datos pasa por **Server Actions** de Next (`src/actions/`), que validan en el servidor y dejan que la base (RLS) sea la barrera entre barberías. El único endpoint HTTP es el health check, que no toca la base ni la sesión:

```bash
curl https://clippr-v2.sistemalety.workers.dev/api/health
# {"status":"ok","service":"clippr-v2","timestamp":"..."}
```

| Archivo                                     | Qué resuelve                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `auth.actions.ts`                           | Registro del dueño (exige aceptar Términos y Privacidad), login, logout, cambiar contraseña |
| `account.actions.ts`                        | Eliminar la propia cuenta (el dueño borra la barbería; el barbero se anonimiza)             |
| `barbershop.actions.ts`                     | Teléfono de la barbería (sólo el dueño)                                                     |
| `team.actions.ts`                           | Equipo: listar, dar de alta barberos, editar nivel y comisión                               |
| `service.actions.ts` / `product.actions.ts` | Catálogo de servicios y productos                                                           |
| `cash.actions.ts`                           | Caja: abrir, cerrar (con el resumen del ticket y la racha), movimientos, ventas             |
| `walkin.actions.ts` / `agenda.actions.ts`   | Cobrar walk-ins y turnos, agendar, cancelar                                                 |
| `stats.actions.ts`                          | Estadísticas del dueño y del barbero, cierres del día, ticket del mes, tarjeta de sellos    |

Los cobros llaman a funciones de Postgres (`SECURITY DEFINER`) que hacen todas las escrituras en una transacción; el monto lo lee la base, nunca viaja desde el cliente.

## Páginas públicas

`/terminos`, `/privacidad`, `/ayuda` y `/eliminar-cuenta` se leen sin iniciar sesión. Los datos del responsable y el email de contacto están en `src/lib/legal.ts`. **Mientras `contactEmail` sea `null`, no publicar**: las páginas muestran "[email de soporte pendiente]".

## Estructura

```text
src/
  app/
    api/health/        # Health check
    (auth)/            # Login y registro
    (legal)/           # Términos, privacidad, ayuda, eliminar cuenta (públicas)
    (dashboard)/       # inicio, caja, agenda, servicios, productos, equipo, mas, estadisticas
  components/
    ui/                # Botones, campos, cubos (Tile), poste, sello, switches
    ticket/            # TicketReceipt, BlankTicket, el ticket del cierre
    share/             # Compartir en el estado de WhatsApp
    timers/            # Temporizadores de /inicio
  actions/             # Server Actions (ver API)
  lib/                 # Fechas del negocio, racha, niveles, resúmenes de caja, clientes de Supabase
  store/               # Zustand: temporizadores y el ticket del cierre
  types/               # Tipos del dominio
supabase/migrations/   # Schema, RLS y funciones, en orden (`supabase db push`)
public/icons/          # Íconos de la PWA (SVG fuente en design/icono/)
```
