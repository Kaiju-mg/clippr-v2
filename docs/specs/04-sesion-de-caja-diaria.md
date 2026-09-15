# Spec: 04 - Sesión de Caja Diaria (Apertura y Cierre)

## 1. Descripción
Implementación de la cuarta rebanada vertical: Sesión de Caja Diaria. Es el núcleo financiero de la aplicación para el barbero. Antes de comenzar a atender turnos y cobrar, el barbero debe "abrir su caja" con un saldo inicial (el efectivo que tiene en el cajón). Al terminar su jornada, debe "cerrar la caja". 

## 2. Archivos a crear / modificar

### Base de Datos & Migraciones
- `supabase/migrations/XXXXXXXXXXXXXX_create_cash_sessions_table.sql`: Script para crear la tabla `cash_sessions`.
  - Habilitar RLS con `public.current_barbershop_id()`.
  - **Crítico:** Crear un índice único parcial (Unique Partial Index) para garantizar a nivel de base de datos que un usuario no pueda tener más de una caja con `status = 'open'` al mismo tiempo.
- (Si es necesario) `src/types/index.ts`: Agregar o actualizar la interfaz `CashSession`.

### Backend / Server Actions
- `src/actions/cash.actions.ts`: Aquí vivirán las transacciones financieras. Toda la lógica de negocio ocurre en el servidor para evitar que un reloj de cliente desfasado o una petición manipulada alteren el balance.
- `src/actions/__tests__/cash.test.ts`: Pruebas de los Server Actions (especialmente probar el rechazo al intentar abrir una segunda caja).

### Interfaz de Usuario (UI)
- `src/app/(dashboard)/caja/page.tsx`: Server Component principal. Su lógica será condicional:
  - Si el usuario **no tiene** una caja abierta: Renderiza la vista de "Abrir Caja".
  - Si el usuario **tiene** una caja abierta: Renderiza el dashboard de la caja actual (que por ahora solo tendrá el botón de "Cerrar Caja").
- `src/app/(dashboard)/caja/_components/OpenCashView.tsx`: Pantalla minimalista con un input numérico gigante para el "Saldo Inicial" y un botón enorme para abrir la caja (fácil de tocar en el celular).
- `src/app/(dashboard)/caja/_components/CloseCashButton.tsx`: Botón que dispara la acción de cierre. Idealmente con un diálogo de confirmación (tipo Bottom Sheet o in-line) para evitar cierres accidentales.

## 3. Modelo de Datos
Entidad `CashSession`:
- `id` (UUID, Primary Key)
- `user_id` (UUID, referencia a `users`. Dueño de la caja)
- `barbershop_id` (UUID, referencia a `barbershops` para aislamiento RLS)
- `initial_balance` (Numeric, el dinero base en el cajón, no nulo)
- `final_balance` (Numeric, nullable, calculado y guardado al cerrar)
- `start_time` (Timestamp with time zone, default `now()`)
- `end_time` (Timestamp with time zone, nullable)
- `status` (Enum/String: `'open'` | `'closed'`)

## 4. Endpoints / Server Actions
- `getCurrentCashSessionAction()`: Busca y devuelve la caja donde `user_id` sea el usuario autenticado y `status === 'open'`.
- `openCashSessionAction(initialBalance: number)`:
  1. Verifica que el usuario no tenga ya una sesión abierta.
  2. Inserta el nuevo registro con `status = 'open'`.
  3. Ejecuta `revalidatePath('/caja')` para cambiar la vista.
- `closeCashSessionAction(sessionId: string)`:
  1. Verifica que la sesión pertenezca al usuario que la intenta cerrar.
  2. (En futuras specs, aquí sumará todos los turnos completados). Por ahora, simplemente iguala `final_balance` al `initial_balance` (ya que aún no hay cobros).
  3. Actualiza `status = 'closed'` y `end_time = now()`.
  4. Ejecuta `revalidatePath('/caja')`.

## 5. Casos Borde y Consideraciones

- **Condiciones de Carrera (Race Conditions):** Si un usuario toca el botón de "Abrir Caja" tres veces muy rápido en un celular con mal internet, el Server Action podría ejecutarse 3 veces. Para evitar que se abran 3 cajas, es **obligatorio** el índice único en la base de datos: `CREATE UNIQUE INDEX one_open_session_per_user ON cash_sessions (user_id) WHERE status = 'open';`. El servidor debe atajar este error SQL amablemente.
- **Fechas y Zonas Horarias:** Usar siempre `timestamptz` (Timestamp with time zone) en Postgres. Dejar que la base de datos asigne el `now()` en lugar de enviarlo desde el cliente (Next.js), ya que el celular del barbero podría tener la hora mal configurada.
- **Aislamiento Multi-Tenant y Permisos:** 
  - El RLS garantiza que la barbería A no vea las cajas de la barbería B.
  - Pero dentro de la barbería, la política de inserción/actualización debe asegurar que un barbero **solo puede abrir o cerrar su propia caja** (validando `user_id`).
- **Diseño UI:** Al ser una acción diaria obligatoria, la vista de "Abrir Caja" no debe ser un formulario aburrido. El campo de ingreso de dinero debe ser el foco central de la pantalla, estilo terminal de punto de venta (POS).

## 6. Plan de Pruebas (Test)
- **Bloqueo de Doble Caja:** Loguearse como barbero, abrir una caja. Usar Postman o un doble click rápido para intentar abrir otra; el sistema debe rechazarlo.
- **Flujo Completo:** Abrir caja con 50.000 Gs. Verificar que la pantalla cambie al dashboard de caja abierta. Cerrar caja, verificar que la pantalla vuelva al inicio y que en base de datos la caja esté `closed` con su `end_time`.
- **Aislamiento por Usuario:** El Dueño (o Barbero 1) no puede cerrar la caja abierta del Barbero 2 por API.
