# Spec 09: Estabilización, Seguridad y Pulido UX

Este documento funciona como hoja de ruta detallada para saldar la deuda técnica de Alta y Media prioridad, y pulir los detalles visuales de la aplicación antes de la entrada de usuarios reales.

## 🛠️ Paso 1: Transaccionalidad Atómica (Alta Prioridad)

**Objetivo:** Evitar datos corruptos o desfasados si se corta la conexión en medio de un cobro o una venta.

- [ ] **Migración SQL (RPC para Walk-ins):** Crear una función `complete_walkin_and_charge` (`SECURITY DEFINER`) que reciba `appointment_id`, `cash_session_id`, y el `amount`. Dentro de esta función, usar transacciones ACID nativas (`BEGIN; ... COMMIT;`) para hacer el `UPDATE` en `appointments` y el `INSERT` en `transactions`.
- [ ] **Migración SQL (RPC para Productos):** Crear una función `sell_product_and_charge` (`SECURITY DEFINER`) que reciba `product_id`, `cash_session_id`, `quantity`, y `amount`. La función debe hacer el `UPDATE products SET stock = stock - quantity` y luego el `INSERT` en `transactions`. Si el stock es insuficiente, hacer un `ROLLBACK`.
- [ ] **Actualización de Server Actions:** Modificar `completeWalkinAction` y `sellProductAction` para eliminar las múltiples llamadas a Supabase y reemplazarlas por una única llamada a `supabase.rpc(...)`.

## 🔒 Paso 2: Seguridad en Gamificación (Alta Prioridad)

**Objetivo:** Impedir que los barberos manipulen sus propias estadísticas (nivel y racha) desde el cliente.

- [ ] **Migración SQL (Ajuste de Políticas RLS):** 
  - Eliminar o modificar la política actual `users_update_same_barbershop` que permite a cualquier usuario actualizar cualquier fila de su barbería.
  - Crear políticas granulares: Un usuario solo puede actualizar campos no sensibles de su propio perfil (como `name` o `avatar`).
  - Asegurar que la función `updateStreakAndLevel` corra bajo un entorno seguro que ignore el RLS (`service_role` o una función RPC `SECURITY DEFINER`), ya que el servidor sí necesita modificar estos valores.

## 📊 Paso 3: Separación de Ingresos en Estadísticas (UX/Lógica)

**Objetivo:** Mostrar un Ticket Promedio exacto, sin mezclar cortes de pelo con venta de productos.

- [ ] **Migración SQL (Nueva Columna):** Ejecutar `ALTER TABLE transactions ADD COLUMN category text NOT NULL DEFAULT 'service';` y agregar un `CHECK (category IN ('service', 'product', 'manual'))`.
- [ ] **Actualizar Inserciones:** 
  - Al cobrar un turno (Walk-in o Agenda), insertar con `category: 'service'`.
  - Al vender un producto, insertar con `category: 'product'`.
  - Al agregar un ingreso/egreso manual en la caja, insertar con `category: 'manual'`.
- [ ] **Actualizar UI (`/estadisticas`):** Modificar `getOwnerStatsAction` para que el cálculo del "Ticket Promedio" solo divida la suma de los montos de tipo `'service'` entre la cantidad total de cortes. 

## ✨ Paso 4: Pulido de UX/UI (Detalles Menores)

**Objetivo:** Corregir las fricciones y confusiones visuales documentadas en la interfaz.

- [ ] **Fix en `/agenda` (Turnos Futuros):** Modificar `AppointmentRow.tsx`. Importar `getTodayAsuncion()` de `src/lib/dates.ts` y si la fecha del turno es mayor a hoy, deshabilitar el botón "Cobrar" y/o ocultarlo para evitar falsos positivos con el estado optimista.
- [ ] **Fixes en `/equipo`:**
  - Cambiar el botón "Agregar Barbero" a "Agregar barbero" (sentence case).
  - En `BarberInlineForm.tsx`, cambiar el label "Correo" a "Email".
  - En la lista del equipo (`equipo/page.tsx`), agregar una validación visual: Si el rol es `owner`, ocultar el texto de porcentaje de comisión (`0%`) para evitar ruido visual.
  - Cambiar cualquier uso de `text-red-600` por el token oficial del proyecto `text-danger`.

## 🤖 Paso 5: Automatización de Tests E2E de Seguridad (Prioridad Media/Alta)

**Objetivo:** Garantizar que ninguna futura actualización rompa el aislamiento entre distintas barberías.

- [ ] **Setup Vitest/Supabase:** Crear un entorno o script de prueba automatizado `rls.test.ts`.
- [ ] **Pruebas de Aislamiento:**
  - Crear `Barberia A` y `Barberia B` con datos dummy.
  - Autenticar como barbero de la `Barberia A` e intentar hacer un `SELECT` a la `CashSession` o `Appointments` de la `Barberia B`. Afirmar (Assert) que retorne vacío o error de permisos.
