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
