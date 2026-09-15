# Spec: 05 - Flujo de Walk-ins y Temporizador Múltiple

## 1. Descripción
Implementación de la quinta rebanada vertical. Este es el flujo de uso constante ("core") del barbero. Permite iniciar uno o más temporizadores simultáneos cuando un cliente llega sin turno previo (Walk-in) o cuando hay tiempos muertos (ej. esperar que actúe un tinte). Al finalizar el tiempo, el barbero selecciona qué servicio realizó y "cobra", lo cual registra el corte y suma el dinero a su caja abierta.

## 2. Archivos a crear / modificar

### Base de Datos & Migraciones
- `supabase/migrations/XXXXXXXXXXXXXX_create_appointments_and_transactions.sql`:
  - Crear tabla `appointments` y `transactions`.
  - Configurar RLS: el dueño ve todo lo de su tenant, el barbero solo inserta/lee lo suyo (patrón similar a `cash_sessions`).
  - Setear `user_id` y `barbershop_id` vía `default current_user_id()` y `default current_barbershop_id()` para `appointments`.

### Frontend / Manejo de Estado (Offline)
- `src/store/timerStore.ts`: Store global de Zustand. **Crítico:** Debe usar el middleware `persist` para guardar el estado en `localStorage`.

### Backend / Server Actions
- `src/actions/walkin.actions.ts` (o `appointment.actions.ts`): Acciones para interactuar con la base de datos al finalizar un temporizador.
- `src/actions/__tests__/walkin.test.ts`: Pruebas de la lógica de servidor.

### Interfaz de Usuario (UI)
- `src/app/(dashboard)/page.tsx` (o la ruta principal de trabajo del barbero): Mostrará los temporizadores activos y el botón para iniciar uno nuevo.
- `src/components/timers/TimerList.tsx` y `TimerCard.tsx`: Componentes visuales para los cronómetros.
- `src/components/timers/FinishWalkinForm.tsx`: Componente (probablemente in-line o bottom sheet, manteniendo la estética limpia) que aparece al detener un timer. Pide seleccionar el `Service` de una lista desplegable y confirmar el cobro.

## 3. Modelo de Datos
Entidades basadas en `docs/arquitectura.md`:

**Appointment (Turno):**
- `id` (UUID, PK)
- `barbershop_id` (UUID, FK a `barbershops`)
- `user_id` (UUID, FK a `users` - barbero asignado)
- `service_id` (UUID, FK a `services`)
- `client_name` (String, nullable - ej. "Cliente de paso")
- `start_time` (Timestamptz)
- `end_time` (Timestamptz)
- `status` (Enum/String: `walkin`, `completed`, `cancelled`) - *Nota: `walkin` representará el estado "en progreso".*

**Transaction (Movimiento de Caja):**
- `id` (UUID, PK)
- `cash_session_id` (UUID, FK a `cash_sessions`)
- `type` (String: `'income'` | `'expense'`)
- `amount` (Integer - guaraníes)
- `description` (String - ej. "Pago por Corte Clásico")
- `created_at` (Timestamptz)

## 4. Endpoints / Server Actions

- `completeWalkinAction(payload: { serviceId, startTime, endTime, cashSessionId, amount })`:
  1. Verifica que la caja (`cashSessionId`) pertenezca al usuario y esté abierta.
  2. Inserta el registro en `appointments` con `status = 'completed'`.
  3. Inserta el registro en `transactions` (tipo `'income'`) vinculado a la caja.
  4. *(Deuda técnica transaccional)*: Al estar en Node.js sin un RPC, se harán dos operaciones separadas. Manejar los errores cuidadosamente si la segunda falla.

## 5. Lógica del Frontend (Zustand) - Arquitectura Crítica

- **Estructura del Store:** Debe ser un arreglo para soportar concurrencia.
  ```typescript
  interface Timer {
    id: string; // Generado localmente
    startTime: number; // Date.now()
    label?: string; // Ej. "Corte", "Tinte"
  }
  ```
- **El patrón de rendimiento:** El estado global de Zustand **NO debe guardar los segundos que transcurren** (no usar `setInterval` que actualice Zustand cada 1 segundo). Si Zustand cambia cada segundo, toda la app hace re-render.
- **Solución:** Zustand solo guarda el `startTime` (una marca de tiempo estática). Dentro del componente `TimerCard.tsx`, un `useEffect` local calcula `Date.now() - startTime` cada segundo para actualizar exclusivamente ese texto visual. Esto garantiza rendimiento fluido y sobrevive a caídas de internet o cierres de pestaña.

## 6. Casos Borde y Consideraciones

- **Sin Caja Abierta:** Si el barbero intenta cobrar un timer pero no ha abierto su `CashSession` del día (Rebanada 04), la UI debe bloquear la acción "Cobrar" y mostrarle un aviso: "Debes abrir tu caja diaria antes de cobrar un corte".
- **Red Inestable:** Si el barbero le da a "Cobrar" y no hay internet, el timer de Zustand podría pausarse pero no eliminarse hasta que la petición al servidor responda con éxito (o dejarlo en una cola de sincronización para la V2).
- **Estética:** Mantener fondo blanco. Un timer activo no necesita ser rojo y ruidoso, puede ser un texto grande con el tiempo corriendo y un botón sobrio de "Finalizar".
- **Caché:** Ejecutar `revalidatePath` pertinente al completar el corte para que, si el barbero navega a `/caja`, vea reflejada la transacción.

## 7. Plan de Pruebas (Test)
- **Persistencia Local:** Iniciar un temporizador, presionar F5 (recargar página), cerrar el navegador y volver a abrirlo. El temporizador debe seguir corriendo exactamente donde debería (porque compara contra la hora actual del sistema).
- **Control de Caja:** Intentar cobrar un Walk-in sin caja abierta -> debe rechazar.
- **Flujo Completo:** Iniciar timer -> Finalizar -> Seleccionar servicio "Corte + Barba" -> Cobrar. Verificar en DB que se crearon el `appointment` y la `transaction` correspondiente a ese monto.
