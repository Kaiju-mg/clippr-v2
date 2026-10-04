# Changelog

Los cambios de Clippr v2, del más nuevo al más viejo. Las fechas son las de
cada entrega; el detalle de cada una está en `docs/arquitectura.md` y el
porqué en `docs/decisiones.md`.

## Sin publicar

- **Términos y Condiciones, Política de Privacidad, Ayuda y Eliminar cuenta**
  como páginas públicas (`/terminos`, `/privacidad`, `/ayuda`,
  `/eliminar-cuenta`), enlazadas desde el login, el registro y Más.
- **Casilla "Acepto los Términos y la Política de Privacidad"** obligatoria al
  registrar una barbería; la versión aceptada y la fecha quedan en el usuario.
- **Eliminar mi cuenta** desde Más: el dueño borra la barbería entera (con las
  cuentas del equipo); el barbero se anonimiza y su historia queda en la caja
  del negocio. Migración `20261004010000_users_auth_set_null_on_delete.sql`.
- Las cuentas eliminadas no aparecen en Equipo.
- `README.md` reescrito y este `CHANGELOG.md`.

## 2026-10-04 — Pulido

- **"Mi barbería / Yo"** en Estadísticas para el dueño: "Yo" muestra sólo sus
  números como barbero.
- **Servicios y Productos como listas en papel**: filas punteadas, duraciones
  y stock en mono, línea de resumen.
- **Descartar un corte** arrancado sin querer, con confirmación (antes sólo se
  podía cobrar).
- El naranja de advertencia del tema claro pasa a `#9a5212` (contraste AA).
- Guía de producción (`docs/produccion.md`) y medición de CPU en Cloudflare.

## 2026-10-04 — Tema Recibo (spec 10)

- **Fase 5**: ícono de la app (el poste sobre papel) y pantalla de arranque.
- **Fase 4**: pantallas vacías como ticket en blanco, "Cierres de hoy" para
  el dueño, ticket del mes y tarjeta de sellos de la racha para el barbero.
- **Fase 3**: compartir el día en el estado de WhatsApp (imagen 9:16 sin
  montos por defecto), teléfono de la barbería, aviso "Sin señal" que
  bloquea cobrar y cerrar, y vibración. Migración del teléfono y del `update`
  de barberías sólo para el dueño.
- **Fase 2**: sello (COBRADO, AGOTADO, MEJOR DEL MES, la racha), movimientos
  de caja como ticket y el cierre que se imprime.
- **Fase 1** (2026-10-03): paleta papel, tinta y sello; IBM Plex Mono en
  montos y horas; horas en 24 h.

## 2026-10-03 — Cloudflare, campos y poste

- Publicada en Cloudflare Workers con OpenNext.
- Campos de formulario con etiqueta flotante.
- El poste de barbería para la racha (viva, en peligro, apagada) y sus
  niveles acero, oro y encendido.

## 2026-09-20 — Estabilización (spec 09), bento y modo oscuro

- Cobros atómicos en funciones de Postgres; un barbero ya no puede tocar su
  racha ni su nivel; categoría en cada movimiento de caja.
- Grilla de cubos en Inicio, Caja y Estadísticas; modo oscuro con switch en
  Más.
- Empezar un turno agendado con el temporizador desde Inicio.

## 2026-09-17 — Estadísticas, niveles y rachas (spec 08)

- Tablero del dueño (ingresos, cortes, ticket promedio, ranking) y del
  barbero (su día, su racha, su nivel).
- Nivel como liga de 30 días móviles; racha con un día de gracia.

## 2026-09-16 — Productos, caja y contraseñas

- Productos con stock, ventas, ingresos y egresos manuales (spec 07).
- Agenda de turnos programados (spec 06) y su estabilización: fechas en
  `America/Asuncion`, cobro anticipado, saldo real de caja.
- Contraseña temporal aleatoria para cada barbero y pantalla para cambiarla.

## 2026-09-15 — Caja y walk-ins

- Caja diaria: apertura, cierre y bloqueo de doble caja (spec 04).
- Walk-ins con temporizador que sobrevive a recargar la página (spec 05).
- Navegación inferior con cuatro íconos (spec 05.5) y sistema de botones.

## 2026-09-14 — Catálogo y equipo

- Catálogo de servicios con activar y desactivar (spec 02).
- Alta y edición de barberos por el dueño (spec 03).

## 2026-09-13 — Base

- Next.js 15, Supabase y Tailwind v4; registro, login y aislamiento entre
  barberías con RLS (spec 01).
