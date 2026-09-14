# Backlog de Clippr v2 (Rebanadas Verticales)

Este backlog divide el desarrollo en rebanadas verticales. Cada iteración entregará una funcionalidad completa, desde la base de datos hasta la interfaz de usuario. Están ordenadas por dependencia (no puedes construir la caja sin tener usuarios, ni turnos sin tener servicios).

### 1. Infraestructura Base, Auth y Multi-Tenant
La fundación del sistema. Sin esto, no hay separación entre barberías.
- **Modelo:** `Barbershop`, `User` (perfil dueño).
- **Server Action:** Registro de cuenta, Login, Creación de la Barbería asociada.
- **UI:** Setup de Next.js + PWA (manifest.json), Páginas de Login/Registro, Layout principal vacío con Navbar (Mobile First).
- **Test:** Flujo de registro e inicio de sesión. Verificación de creación automática del tenant.

### 2. Catálogo de Servicios 👈 *[LA MÁS CHICA PARA EMPEZAR DESPUÉS DEL SETUP]*
Ideal para probar tu stack end-to-end (Next.js -> Server Actions -> Supabase RLS) de forma sencilla antes de meterte en la lógica compleja.
- **Modelo:** `Service`.
- **Server Action:** Crear, Leer, Actualizar y Borrar (CRUD) servicios.
- **UI:** Pantalla `/servicios` con lista, botón y modal/formulario para agregar un corte/servicio y su precio.
- **Test:** Un dueño crea un servicio. Validar mediante Row Level Security (RLS) que una barbería A no puede ver los servicios de la barbería B.

### 3. Gestión del Equipo (Barberos)
Permite al dueño tener empleados para luego asignarles turnos y cajas.
- **Modelo:** `User` (roles: owner, barber).
- **Server Action:** Crear barbero, listar equipo, editar comisión.
- **UI:** Pantalla `/equipo` con lista de barberos, formulario para agregar un empleado, asignar rol y nivel (Junior, Pro).
- **Test:** Probar que el dueño puede crear barberos en su tenant y que estos puedan iniciar sesión.

### 4. Sesión de Caja Diaria (Apertura y Cierre)
El núcleo financiero diario para cada barbero.
- **Modelo:** `CashSession`.
- **Server Action:** Abrir caja (validar que no haya otra abierta), Cerrar caja (calcular balance final).
- **UI:** Pantalla `/caja` que muestra estado actual. Botón gigante de "Abrir Caja" con input de saldo inicial. Botón de "Cerrar Caja".
- **Test:** Un barbero no puede abrir dos cajas al mismo tiempo. Al cerrar, el `status` cambia a closed.

### 5. Flujo de "Walk-ins" y Temporizador
El "core feature" de uso constante en la barbería.
- **Modelo:** `Appointment` (estado `completed`, tipo `walkin`).
- **Server Action:** Guardar turno completado y sumar monto al balance de la `CashSession` activa.
- **UI:** Pantalla principal del barbero. Temporizador múltiple usando Zustand (persistencia local). Al finalizar el timer, formulario rápido (Seleccionar Servicio -> Cobrar).
- **Test:** Simular recarga de página (F5) para asegurar que el temporizador no se pierde (Zustand persist). Guardar corte y verificar que el monto impacta la caja del barbero.

### 6. Agenda de Turnos Programados
Para los clientes que reservan con anticipación.
- **Modelo:** `Appointment` (estado `scheduled`).
- **Server Action:** Agendar turno, Marcar como completado, Cancelar.
- **UI:** Pantalla `/agenda` con vista de lista diaria de turnos. Modal para agendar (cliente, servicio, hora). Botón para pasar de "agendado" a "completado" (lo que impacta en la caja).
- **Test:** Agendar turno con conflicto de horario (opcional) y pasar turno a completado verificando el impacto financiero.

### 7. Productos y Movimientos de Caja (Ingresos/Egresos extras)
Cubre el control de stock básico y los gastos diarios (ej. comprar café).
- **Modelo:** `Product`, `Transaction`.
- **Server Action:** CRUD productos. Registrar `Transaction` manual y actualizar saldo de `CashSession`. Reducir stock al vender.
- **UI:** Sección de productos. En la pantalla `/caja`, botones para "Añadir Gasto" o "Vender Producto" (sin turno).
- **Test:** Registrar un gasto manual y comprobar que el `final_balance` en memoria y DB descuenta el monto correctamente.

### 8. Estadísticas, Niveles y Rachas (Gamificación)
Cierre del ciclo de retención y análisis de negocio.
- **Modelo:** Actualización de `streak_count` y `level` en `User`.
- **Server Action:** Calcular ingresos mensuales/semanales (Dueño). Evaluar racha diaria al cerrar primera caja (Barbero).
- **UI:** Dashboard Dueño (Gráficos simples de ingresos, cortes totales). Dashboard Barbero (Tu nivel actual, cortes del día, barra de progreso para subir a "Pro").
- **Test:** Completar un turno/caja en días consecutivos y verificar que la racha sube.
