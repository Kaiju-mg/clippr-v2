# Backlog de Clippr v2 (Rebanadas Verticales)

Este backlog divide el desarrollo en rebanadas verticales. Cada iteración entregará una funcionalidad completa, desde la base de datos hasta la interfaz de usuario. Están ordenadas por dependencia (no puedes construir la caja sin tener usuarios, ni turnos sin tener servicios).

### 1. Infraestructura Base, Auth y Multi-Tenant (implementado)
La fundación del sistema. Sin esto, no hay separación entre barberías.
- **Modelo:** `Barbershop`, `User` (perfil dueño).
- **Server Action:** Registro de cuenta, Login, Creación de la Barbería asociada.
- **UI:** Setup de Next.js + PWA (manifest.json), Páginas de Login/Registro, Layout principal vacío con Navbar (Mobile First).
- **Test:** Flujo de registro e inicio de sesión. Verificación de creación automática del tenant.

Ver `docs/arquitectura.md` sección "Auth y Multi-Tenant".

### 2. Catálogo de Servicios (implementado)
Ideal para probar tu stack end-to-end (Next.js -> Server Actions -> Supabase RLS) de forma sencilla antes de meterte en la lógica compleja.
- **Modelo:** `Service`.
- **Server Action:** Crear, Leer, Actualizar y Borrar (CRUD) servicios.
- **UI:** Pantalla `/servicios` con lista, botón y modal/formulario para agregar un corte/servicio y su precio.
- **Test:** Un dueño crea un servicio. Validar mediante Row Level Security (RLS) que una barbería A no puede ver los servicios de la barbería B.

Ver `docs/arquitectura.md` sección "Catálogo de Servicios".

### 3. Gestión del Equipo (Barberos) (implementado)
Permite al dueño tener empleados para luego asignarles turnos y cajas.
- **Modelo:** `User` (roles: owner, barber).
- **Server Action:** Crear barbero, listar equipo, editar comisión.
- **UI:** Pantalla `/equipo` con lista de barberos, formulario para agregar un empleado, asignar rol y nivel (Junior, Pro).
- **Test:** Probar que el dueño puede crear barberos en su tenant y que estos puedan iniciar sesión.

Ver `docs/arquitectura.md` sección "Gestión de Equipo".

### 4. Sesión de Caja Diaria (Apertura y Cierre) (implementado)
El núcleo financiero diario para cada barbero.
- **Modelo:** `CashSession`.
- **Server Action:** Abrir caja (validar que no haya otra abierta), Cerrar caja (calcular balance final).
- **UI:** Pantalla `/caja` que muestra estado actual. Botón gigante de "Abrir Caja" con input de saldo inicial. Botón de "Cerrar Caja".
- **Test:** Un barbero no puede abrir dos cajas al mismo tiempo. Al cerrar, el `status` cambia a closed.

Ver `docs/arquitectura.md` sección "Sesión de Caja Diaria".

### 5. Flujo de "Walk-ins" y Temporizador (implementado)
El "core feature" de uso constante en la barbería.
- **Modelo:** `Appointment` (estado `completed`, tipo `walkin`).
- **Server Action:** Guardar turno completado y sumar monto al balance de la `CashSession` activa.
- **UI:** Pantalla principal del barbero. Temporizador múltiple usando Zustand (persistencia local). Al finalizar el timer, formulario rápido (Seleccionar Servicio -> Cobrar).
- **Test:** Simular recarga de página (F5) para asegurar que el temporizador no se pierde (Zustand persist). Guardar corte y verificar que el monto impacta la caja del barbero.

Ver `docs/arquitectura.md` sección "Flujo de Walk-ins y Temporizador".

### 5.5. Navegación Minimalista (implementado)
Rebanada chica, no prevista en el backlog original: sin esto, el dashboard
era un conjunto de pantallas sueltas sin forma de moverse entre ellas
salvo escribiendo la URL a mano.
- **UI:** Barra de navegación inferior fija (Inicio, Caja, Agenda, Más) y
  pantalla `/mas` con los accesos a Servicios, Equipo y Cerrar sesión.

Ver `docs/arquitectura.md` sección "Navegación Minimalista" y
`docs/specs/05.5-navegacion-minimalista.md`. Refinada visualmente el
2026-09-15 (tipografía, íconos, botones, cabecera de `/inicio`) — ver
`docs/arquitectura.md` sección "Sistema de Diseño" y `docs/decisiones.md`.

### 6. Agenda de Turnos Programados (implementado)
Para los clientes que reservan con anticipación.
- **Modelo:** `Appointment` (estado `scheduled`).
- **Server Action:** Agendar turno, Marcar como completado, Cancelar.
- **UI:** Pantalla `/agenda` con vista de lista diaria de turnos. Formulario in-line para agendar (cliente, servicio, hora — sin modal, ver `docs/decisiones.md`). Botón para pasar de "agendado" a "completado" (lo que impacta en la caja).
- **Test:** Agendar turno con conflicto de horario (se permite solapar, spec 06) y pasar turno a completado verificando el impacto financiero.

Ver `docs/arquitectura.md` sección "Agenda de Turnos Programados" y
`docs/specs/06-agenda-de-turnos-programados.md`. Seguida de un sprint de
estabilización (2026-09-16): fechas en `America/Asuncion`, duración de
turnos cobrados antes de hora, y saldo real de caja en pantalla y al
cerrar — ver `docs/decisiones.md`.

### 7. Productos y Movimientos de Caja (Ingresos/Egresos extras) (implementado)
Cubre el control de stock básico y los gastos diarios (ej. comprar café).
- **Modelo:** `Product`, `Transaction`.
- **Server Action:** CRUD productos. Registrar `Transaction` manual y actualizar saldo de `CashSession`. Reducir stock al vender.
- **UI:** Sección de productos. En la pantalla `/caja`, botones para "Añadir Gasto" o "Vender Producto" (sin turno).
- **Test:** Registrar un gasto manual y comprobar que el `final_balance` en memoria y DB descuenta el monto correctamente. (El cálculo inicial + ingresos − egresos ya existe desde el 2026-09-16 en `computeBalance`, `cash.actions.ts` — los egresos solo tienen que insertarse como `type: "expense"`.)

Ver `docs/arquitectura.md` sección "Productos y Movimientos de Caja".

### 8. Estadísticas, Niveles y Rachas (Gamificación) (implementado)
Cierre del ciclo de retención y análisis de negocio.
- **Modelo:** Actualización de `streak_count` y `level` en `User`.
- **Server Action:** Calcular ingresos mensuales/semanales (Dueño). Evaluar racha diaria al cerrar primera caja (Barbero).
- **UI:** Dashboard Dueño (Gráficos simples de ingresos, cortes totales). Dashboard Barbero (Tu nivel actual, cortes del día, barra de progreso para subir a "Pro").
- **Test:** Completar un turno/caja en días consecutivos y verificar que la racha sube.

Dos reglas que la spec dejaba abiertas se definieron con el usuario
(2026-09-17): el nivel es una **liga de 30 días móviles** (puede bajar) y la
racha tolera **un día de gracia**. Ver la sección 6 de
`docs/specs/08-estadisticas-niveles-rachas.md` y `docs/decisiones.md`.

Ver `docs/arquitectura.md` sección "Estadísticas, Niveles y Rachas".

### 9. Estabilización, Seguridad y Pulido (pasos 1–4 implementados; paso 5 pospuesto)
No es una rebanada de producto: salda la deuda técnica de Alta y Media prioridad antes de la entrada de usuarios reales.
- **Migraciones (aplicadas el 2026-09-20):** RPC atómicos de cobro y venta (`20260920000000`), cierre del `update` de `users` con grants por columna + RPC del dueño (`20260920010000`), columna `transactions.category` (`20260920020000`) y el revoke de `execute` a `anon` que las dos primeras no lograban (`20260920030000`, encontrado al verificar).
- **Server Actions:** `completeWalkinAction`, `completeScheduledAppointmentAction` y `sellProductAction` pasan a una sola llamada `.rpc(...)`; `applyStreakAndLevel` pasa a `service_role`; `updateBarberAction` pasa al RPC `update_team_member`.
- **UI:** ticket promedio sólo con cortes; `/agenda` sin "Cobrar" en días futuros; cuatro fixes de copy y tokens en `/equipo`, login, registro y servicios.
- **Paso 5 (tests E2E de RLS automatizados): fuera de esta entrega**, por falta de un entorno de base de datos donde correrlos sin ensuciar producción. El plan escrito está en `docs/deuda-tecnica.md`.
- **Test:** Vitest (Supabase mockeado), 183 tests en verde; verificación contra la base por SQL (funciones, grants, policies, backfill) y por HTTP a PostgREST; y prueba de punta a punta en el navegador contra el proyecto real con una cuenta de dueño (walk-in, agenda, día futuro, venta con y sin stock, movimiento manual, ticket promedio, /equipo, cierre con racha 0 → 1). Cero errores de servidor y de consola.

Ver `docs/arquitectura.md` sección "Estabilización, Seguridad y Pulido" y
`docs/decisiones.md` (2026-09-20, cinco entradas: RPC atómicos, el monto que
no viaja como parámetro, la zona horaria fuera del SQL, las tres capas de
`users` y `transactions.category`).

### Bento UI y modo oscuro (2026-09-20, implementado — no es una rebanada del backlog)
Pasada visual sobre specs ya implementadas, más el modo oscuro que el
usuario pidió. No agrega ninguna capacidad de producto nueva salvo dos
datos que ya estaban en la base y no se mostraban: los turnos del día en
`/inicio` y la lista de movimientos en `/caja`.

- **Dirección visual:** grilla de cubos (bento) en `/inicio`, `/caja` y
  `/estadisticas`, con `src/components/ui/Tile.tsx` como primitiva y un
  solo cubo relleno por pantalla. Glassmorphism explorado y descartado.
- **Contenido movido, a pedido del usuario:** racha y cortes arriba de
  "Iniciar corte"; la caja fuera de `/inicio`; los turnos del día abajo;
  el nivel solo en `/estadisticas`.
- **Modo oscuro:** switch en `/mas`, cookie `clippr-theme` leída por el
  servidor. Reemplaza la decisión del 2026-09-14 de tema claro fijo.
- **Sin migraciones.** `getCashMovementsAction` usa columnas que ya
  existían (`transactions.description`/`created_at` de la spec 05,
  `category` de la 09).
- **Test:** Vitest (Supabase mockeado), 203 tests en verde en 19 archivos
  —nuevos: `getCashMovementsAction`, `UpcomingAppointments`,
  `ThemeSwitch` y los formateadores de `dates.ts`—, `npm run build` con
  las 14 rutas, y el mecanismo del tema verificado contra el server de
  producción (cookie → `data-theme` → `theme-color` → CSS servido).
  **Falta el recorrido visual de las pantallas autenticadas en los dos
  temas** (necesita sesión iniciada en el navegador).

Ver `docs/arquitectura.md` sección "Bento UI y Modo Oscuro" y
`docs/decisiones.md` (2026-09-20, cinco entradas: bento, modo oscuro,
los tres tokens de acento, la caja fuera de `/inicio` y los
formateadores de fecha).

### Deploy, campos y poste de la racha (2026-10-03, implementado — no son rebanadas del backlog)
Tres cosas pedidas en la misma sesión, pensando en el piloto con barberos
reales:
- **Deploy en Cloudflare Workers** (OpenNext), plan gratis para probar, en
  https://clippr-v2.sistemalety.workers.dev. La raíz y la PWA abren
  `/inicio`.
- **Campos con etiqueta flotante** (`Input`/`Select`), elegidos en el
  muestrario "Campos de Clippr".
- **Poste de barbería para la racha** en /inicio, /estadisticas y al cerrar
  la caja, elegido en los muestrarios "Animaciones de la racha" y "Poste de
  la racha". **Sin migraciones.**
- **Test:** 263 tests de Vitest, build y capturas en los dos temas. **Falta
  el recorrido con sesión iniciada** en el celular.

Ver `docs/arquitectura.md` secciones "Deploy en Cloudflare Workers",
"Campos de formulario con etiqueta flotante" y "Poste de la racha", y
`docs/decisiones.md` (2026-10-03).

### Próximo: Piloto con barberos reales (pendiente)
Lo que falta antes de darle la app a una o dos barberías conocidas, gratis
y con acompañamiento:
- Recorrer la app entera con sesión iniciada en un celular, en los dos
  temas, y medir la **CPU por pedido** en el dashboard de Cloudflare
  (Workers & Pages → clippr-v2 → Metrics) para decidir entre el plan gratis
  y el de US$5.
- Separar o limpiar la base de producción (hoy es la misma de desarrollo,
  con datos de prueba y cuentas con `Clippr2026!`) y resolver los respaldos.
- Cerrar el `update` de `products` al dueño (migración chica).
- Pasar `feature/deploy-cloudflare` a `main` con un PR.

Ver `docs/deuda-tecnica.md` (Alta prioridad).

### Próximo: Planes y cobro, etapa 1 (propuesta, sin implementar)
Hoy la única pieza es `barbershops.subscription_plan` (`trial`/`pro`/`team`,
default `trial`): no hay vencimiento, ni límites por plan, ni cobro. Lo que
se habló el 2026-10-03, **sin decidir todavía**:
- **Planes:** Trial (todo, 14 a 30 días), Pro (barbero independiente, 1
  usuario) y Equipo (dueño + barberos, con un tope de barberos y un
  adicional por cada extra). Lo que separa los planes es la **cantidad de
  personas**, no las funciones. Precios de referencia: los de la v1 (Gs.
  75.000 y Gs. 150.000), sin validar. No hay herramientas parecidas en
  Paraguay y todavía no se sabe cuánto pagarían: se valida en el piloto (si
  la siguen usando sin que nadie insista, más cuatro preguntas de precio al
  final) y con un **precio fundador** para las primeras 5 a 10 barberías.
- **Cobro manual** al principio: transferencia o QR, y marcar a mano
  `pagado_hasta` en la barbería. Hace falta programar: tabla de planes en la
  base (regla 6), `pagado_hasta` (la prueba gratis es esa misma fecha),
  avisos de vencimiento y, si no paga, no poder abrir una caja nueva pero
  **seguir viendo todos sus datos**. Después, link de pago (Pagopar) con
  webhook; débito automático con tarjeta (Bancard) recién con muchos
  clientes. Stripe no acepta comercios paraguayos.
- **Antes del primer cobro:** RUC y factura electrónica; consultar a un
  contador.

Escribir la spec en `docs/specs/` cuando el piloto confirme los precios.
