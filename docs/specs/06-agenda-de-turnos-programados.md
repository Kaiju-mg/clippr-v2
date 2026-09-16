# Spec 06: Agenda de Turnos Programados

## 1. Descripción general
Esta funcionalidad permite a los barberos agendar turnos futuros (para clientes que reservan con anticipación) y gestionarlos en su día a día. A diferencia de los temporizadores de "walk-ins" (atención inmediata sin turno previo, spec 05), los turnos programados existen en la base de datos antes de que el cliente llegue al local.

La experiencia debe sentirse rápida y sin fricciones, adaptándose a las decisiones de diseño previas: sin modales, con formularios que se expanden de forma *in-line*, uso de UI optimista y protección robusta contra alteraciones de cobro.

## 2. Base de Datos / Modelo
La tabla `appointments` ya fue creada en la migración de la spec 05 y tiene las columnas necesarias.
- **Estados a utilizar:** `scheduled` (cuando se crea) y `cancelled` (si no asiste). El estado `completed` se reutiliza cuando el turno finaliza y se cobra.
- **Columnas clave:** `client_name` (ahora vital para identificar la reserva), `service_id`, `start_time` (inicio planificado) y `end_time` (fin planificado, derivado de la duración del servicio).
- **Aislamiento (RLS):** Las políticas estrictas ya existentes (`appointments_select_own`, `appointments_insert_own` y equivalentes en `transactions`) aseguran de fábrica que un barbero solo vea y opere sobre sus propios turnos programados, cumpliendo la privacidad exigida por el negocio.

## 3. Server Actions (Endpoints)
Crear `src/actions/agenda.actions.ts` con la siguiente lógica de negocio (100% en el servidor):

- **`getAgendaAction(dateISO: string)`:**
  - Devuelve todos los turnos (`scheduled`, `completed`, `cancelled`) del barbero actual para la fecha solicitada, ordenados por `start_time` ascendente. (El filtrado por tenant y user lo garantiza RLS).

- **`scheduleAppointmentAction(payload: { clientName: string, serviceId: string, startTimeISO: string })`:**
  - Valida el servicio y extrae su `duration_minutes`.
  - Calcula el `end_time` planificado sumando los minutos de duración al `startTimeISO`.
  - Inserta el turno en `appointments` con `status = 'scheduled'`.

- **`completeScheduledAppointmentAction(appointmentId: string, cashSessionId: string)`:**
  - Mismos principios que `completeWalkinAction` (spec 05): valida que la caja esté abierta.
  - Lee el precio (`price`) del servicio directamente desde la BD (nunca confía en un monto del cliente).
  - Actualiza el turno a `status = 'completed'` y pisa su `end_time` con la hora real del servidor (`new Date().toISOString()`).
  - Inserta el cobro (ingreso) en `transactions`.
  - *Nota:* No se hace en una transacción atómica RPC, sino con inserts consecutivos manejando errores para ser consistentes con la spec 05.

- **`cancelAppointmentAction(appointmentId: string)`:**
  - Actualiza el turno a `status = 'cancelled'`.

## 4. UI / Componentes
Rutas y componentes a tocar en `src/app/(dashboard)/agenda/`:

- **`page.tsx` (Server Component):**
  - Reemplaza el placeholder actual por la lógica real. Lee la fecha actual por defecto e invoca a `getAgendaAction`. Renderiza el layout principal.

- **`_components/AgendaView.tsx` (Client Component):**
  - Maneja el estado local de la fecha seleccionada (selector simple con flechas para "Día Anterior / Día Siguiente").
  - Muestra la lista de turnos y coordina la llamada a Server Actions.

- **`_components/ScheduleInlineForm.tsx` (Client Component):**
  - Formulario que se despliega *in-line* sobre la lista al tocar "Nuevo Turno", cumpliendo la regla de **no usar modales ni bottom sheets** acordada el 2026-09-14.
  - Inputs: Nombre del cliente, Servicio (Select), y Hora de inicio (Input type time).

- **`_components/AppointmentRow.tsx` (Client Component):**
  - Representa un turno programado en la lista. Se debe ver limpio y minimalista.
  - Acciones principales:
    - **Completar/Cobrar:** Botón de jerarquía primaria o contorno. Si no hay caja abierta, bloquea la acción y muestra un aviso enlazando a `/caja` (igual que el comportamiento actual en walk-ins).
    - **Cancelar:** Accesible como botón secundario, texto ghost o menú desplegable (danger action).
  - Implementa `useOptimistic` para marcar visualmente el estado completado/cancelado de inmediato mientras el servidor resuelve, manteniendo la percepción de velocidad con internet inestable.

## 5. Decisiones de Diseño y Arquitectura (UX/UI)
- **Tipografía y Estética:** Continúa usando fondo blanco (`bg-white` o `bg-surface`), separadores grises muy finos y la tipografía base (`Inter`).
- **Estados vacíos:** Si no hay turnos, mostrar un mensaje claro y un CTA grande para agendar el primer turno.
- **Tolerancia a conexión inestable:** Para la creación y completado del turno se debe confiar en `useOptimistic` en la UI para la respuesta inmediata del estado (feedback optimista). La validación financiera sigue estando protegida en el servidor.

## 6. Casos Borde
- **Solapamiento de turnos:** Se permite crear un turno en un horario ocupado. Es común que el barbero empiece un trabajo secundario (ej. preparar un tinte) mientras termina un corte anterior. No habrá bloqueo estricto en la BD, simplemente se listarán ordenados por su hora de inicio.
- **Hora en el pasado:** Se permitirá agendar turnos en el pasado para el día en curso (ej: el barbero se olvidó de anotarlo a la mañana y lo hace al mediodía).
- **Precio modificado en BD:** Si un servicio cambia de precio entre que se agendó el turno y que el cliente asiste, al completar el turno se cobrará el precio *actual* en catálogo. Esta es una decisión consciente para mantener la base de datos simple, ya que los cambios de precios en el negocio suelen aplicar a todas las citas futuras.

## 7. Cambios posteriores a la implementación (2026-09-16)
Esta spec se implementó y después se ajustó en un sprint de estabilización. El código difiere del texto de arriba en estos puntos (detalle en `docs/decisiones.md`):
- **RLS:** las políticas "ya existentes" no alcanzaban; se agregó `appointments_update_own` (migración `20260916010000_appointments_update_own.sql`).
- **`scheduleAppointmentAction`:** recibe `{ clientName, serviceId, dateISO, time }` en vez de `startTimeISO`. El servidor arma el instante en `America/Asuncion` (`src/lib/dates.ts`).
- **`getAgendaAction`:** corta el día en hora de Paraguay, no en UTC.
- **`completeScheduledAppointmentAction`:** si se cobra antes de la hora agendada, además de `end_time` pisa `start_time = ahora − duración`. No permite cobrar turnos de días futuros.
