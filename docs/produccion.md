# Producción

Qué hace falta para pasar de "la app publicada para probar" a una
producción con barberos reales. Escrito el 2026-10-04, después de terminar
la spec 10. Las entradas de `docs/deuda-tecnica.md` marcadas **[Infra]**
apuntan acá.

## Dónde está cada cosa hoy

| Pieza | Hoy | Problema |
|---|---|---|
| App | Worker `clippr-v2` en Cloudflare (plan gratis), `npm run deploy` desde la copia local | Nada en CI: lo publicado es lo que hay en la máquina de quien publica |
| Base | **Un solo** proyecto de Supabase (plan gratis) para desarrollo **y** producción | Datos de prueba mezclados, cuentas viejas con `Clippr2026!`, sin respaldos, se pausa tras una semana sin uso |
| Código | GitHub `Kaiju-mg/clippr-v2`, rama `feature/deploy-cloudflare` | La rama por defecto del repo sigue siendo `feature/InfraestructuraBaseAuthyMulti-Tenant` |

## 1. Separar la base de producción

**Por qué las dos usan la misma base:** las variables `NEXT_PUBLIC_SUPABASE_URL`
y `NEXT_PUBLIC_SUPABASE_ANON_KEY` se **graban en el código al compilar**
(Next las inlinea), y el deploy compila con `.env.local`, que es el de
desarrollo. `SUPABASE_SERVICE_ROLE_KEY` en cambio se lee en tiempo de
ejecución: en Cloudflare es un secreto del Worker y en local está en
`.dev.vars`.

**Pasos (los hace el dueño de la cuenta de Supabase):**

1. Crear un proyecto nuevo en Supabase, sólo para producción (región São
   Paulo, la más cercana a Paraguay). Guardar la contraseña de la base en un
   gestor de contraseñas: no va en el repo ni en el chat.
2. En Authentication → Providers → Email, dejar "Confirm email" como esté
   decidido para el piloto (hoy está desactivado en el de desarrollo).
3. Aplicar las migraciones al proyecto nuevo. Son **15** desde la fase 3 de
   la spec 10 (la última es `20261004000000_barbershops_phone_owner_update.sql`).
   De paso valida que la secuencia completa corre limpia desde cero, cosa que
   hoy nadie verificó:
   ```
   npx supabase link --project-ref <ref-del-proyecto-de-produccion>
   npx supabase db push
   npx supabase link --project-ref <ref-del-de-desarrollo>   # volver
   ```
4. Crear `.env.production.local` (ya está en `.gitignore`) con la URL y la
   anon key del proyecto **de producción**. Next lo prioriza sobre
   `.env.local` al compilar para producción, así que `npm run deploy` usa
   producción y `npm run dev` sigue usando desarrollo. Ojo: `npm run build` y
   `npm run preview` también compilan para producción, así que con ese
   archivo presente también apuntan a la base de producción.
5. Cambiar el secreto del Worker por la clave de servicio de producción:
   ```
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
6. `npm run deploy` y probar: registro de una barbería nueva, alta de un
   barbero, una caja completa (abrir, cobrar, cerrar) y el teléfono de la
   barbería.
7. Dejar el proyecto viejo como **desarrollo**. Las cuentas con
   `Clippr2026!` quedan ahí, lejos de los barberos reales.

## 2. Respaldos

El plan gratis de Supabase **no tiene respaldos restaurables** y pausa el
proyecto tras una semana sin uso. Dos caminos:

- **Plan Pro (US$25/mes):** respaldos diarios de 7 días y sin pausa. Es lo
  más simple y es lo recomendado apenas haya plata real de barberos. Lo
  contrata el dueño de la cuenta.
- **Volcado programado (gratis):** un GitHub Action diario que corra
  `supabase db dump` contra producción y guarde el archivo como artefacto
  (o en un bucket). Necesita la cadena de conexión de producción como
  secreto del repo. Sirve para no perder todo, pero restaurar es manual y el
  proyecto igual se pausa sin uso.

## 3. CPU por pedido en Cloudflare

El plan gratis de Workers corta cada pedido a los **10 ms de CPU** (el
tiempo esperando a Supabase no cuenta, sólo el cálculo). Si una pantalla se
pasa, el pedido falla con el error **1102** de forma intermitente. La
solución es el plan Workers Paid (US$5/mes, hasta 30 s de CPU por pedido).

**Cómo medirlo:** con `observability` prendido en `wrangler.jsonc`, cada
pedido queda registrado con su CPU. Para mirarlo en vivo:

```
npx wrangler tail clippr-v2 --format json
```

y en otra ventana usar la app publicada con sesión iniciada: `/inicio`,
`/caja` (abrir, cobrar, cerrar), `/agenda`, `/estadisticas` (las dos vistas
del dueño), `/servicios`, `/productos`. Cada línea trae `cpuTime` (ms). En
el panel: Workers & Pages → clippr-v2 → Metrics → CPU Time (mirar el
percentil 99, no el promedio).

La medición del 2026-10-04 está en `docs/deuda-tecnica.md`, en la entrada de
CPU.

## 4. Git

- `main` quedó adelantada a `feature/deploy-cloudflare` el 2026-10-04 (fast
  forward, sin merge). Desde ahí, `main` es el punto de restauración.
- Falta que el dueño del repo cambie la **rama por defecto** de GitHub a
  `main` (Settings → General → Default branch). Si algún día se conecta el
  deploy a GitHub, va a publicar desde la rama por defecto.
- Las ramas viejas (`feature/03-…`, `feature/04-…`, `feature/05-…`,
  `feature/CatalogoDeServicios`, `feature/InfraestructuraBaseAuthyMulti-Tenant`)
  quedan como historia; se pueden borrar cuando `main` sea la rama por
  defecto.
