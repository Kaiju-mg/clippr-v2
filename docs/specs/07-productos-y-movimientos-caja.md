# Spec 07: Productos y Movimientos de Caja

## 1. Objetivo y Alcance
Implementar el control básico de stock (catálogo de productos) y permitir registrar ingresos/egresos manuales en la caja diaria del barbero (ej. gastos rápidos como comprar café o ingresos extra como vender un producto sin un turno agendado).

## 2. Archivos a Tocar

### Base de Datos y Tipos
- `supabase/migrations/[TIMESTAMP]_create_products_table.sql`: Nueva migración para la tabla de productos y sus políticas RLS.
- `src/types/index.ts`: Añadir/actualizar la interfaz `Product` y asegurar que `Transaction` admita los campos necesarios.

### Server Actions (Endpoints de mutación y lectura)
- `src/actions/product.actions.ts` (Nuevo):
  - `getProductsAction`: Obtiene catálogo de productos.
  - `createProductAction`: Alta de producto.
  - `updateProductAction`: Modificar nombre, precio o stock.
  - `toggleProductStatusAction`: Activar/desactivar producto (borrado lógico).
- `src/actions/cash.actions.ts` (Actualización):
  - `registerTransactionAction`: Inserta una nueva `Transaction` (`income` o `expense`) asociada a la caja activa.
  - `sellProductAction`: Descuenta stock de un producto e inserta una `Transaction` de tipo `income`.

### UI y Componentes
- `src/app/(dashboard)/productos/page.tsx` (Nuevo): Server Component para el listado de productos.
- `src/app/(dashboard)/productos/_components/ProductList.tsx` (Nuevo): Lista interactiva con switch optimista.
- `src/app/(dashboard)/productos/_components/ProductInlineForm.tsx` (Nuevo): Formulario in-line (expandible) sin modales para crear/editar productos.
- `src/app/(dashboard)/mas/page.tsx` (Actualización): Agregar el link de acceso a la pantalla de Productos.
- `src/app/(dashboard)/caja/page.tsx` (Actualización): Renderizar la interfaz para añadir movimientos manuales cuando hay una caja abierta.
- `src/app/(dashboard)/caja/_components/TransactionInlineForm.tsx` (Nuevo): Componente para registrar ingresos/egresos con input numérico formateado.
- `src/app/(dashboard)/caja/_components/SellProductForm.tsx` (Nuevo): Selector de producto para efectuar una venta rápida.

## 3. Modelo de Datos y RLS (Row Level Security)

**Tabla `products`:**
- `id` (uuid, PK)
- `barbershop_id` (uuid, default `current_barbershop_id()`)
- `name` (text)
- `price` (integer, sin decimales para PYG)
- `stock` (integer, default 0)
- `low_stock_threshold` (integer, nullable)
- `is_active` (boolean, default true)

**Políticas RLS:**
- Siguiendo el patrón de `services`:
  - `SELECT`: `barbershop_id = current_barbershop_id()` (todo el equipo de la barbería puede ver los productos).
  - `INSERT` / `UPDATE`: A nivel RLS será `barbershop_id = current_barbershop_id()`, y dentro del Server Action se validará si solo el `owner` puede mutar el catálogo o si cualquier barbero puede hacerlo (dependerá de la regla de negocio, sugerido: delegar el control de edición a un rol específico si corresponde, igual que en equipo).

**Tabla `transactions`:**
- Ya existe. Solo requiere insertar filas manuales y que estas sean tomadas en cuenta por el cálculo actual del Server Action `computeBalance`.

## 4. Interfaz de Usuario (Directrices de Diseño)

- **Catálogo de Productos:** 
  - Se accede desde el menú "Más" en el `BottomNav` (`/mas`).
  - Reutiliza exactamente los mismos patrones de `/(dashboard)/servicios`: filas que se expanden in-place (sin bottom sheets), botones con variante de contorno o `secondary`, y switch de `useOptimistic` para activar/desactivar el stock.
- **Movimientos de Caja (`/caja`):**
  - Bajo el saldo actual y el botón de cierre, mostrar una sección secundaria para "Movimiento Manual".
  - Mantener estética minimalista: inputs numéricos que den un formato automático con separadores de miles (`type="text"` y `inputMode="numeric"` con `formatGuaranies`, reutilizando el comportamiento de `OpenCashView`).
  - No usar modales. Emplear un acordeón simple o un layout in-line.

## 5. Casos Borde y Deuda Técnica (A considerar)

1. **Venta de Producto sin Stock:** El Server Action `sellProductAction` debe abortar y retornar un error legible si la cantidad a vender es mayor que el stock actual del producto.
2. **Atomicidad en Venta de Productos:** Al vender un producto, hay que hacer un `UPDATE` (descontar stock) y un `INSERT` (crear transacción). Como Next.js ejecuta consultas separadas (sin usar un trigger o RPC en Supabase), existe el riesgo de que el stock se descuente pero la red falle antes de insertar el ingreso. **Esta es una deuda técnica heredada** que debe registrarse en `docs/deuda-tecnica.md`, similar a lo que ocurre en turnos.
3. **Caja Cerrada/Inexistente:** Se debe bloquear el renderizado o ejecución de gastos/ventas desde el lado del servidor si no hay un `cashSessionId` válido con status `open` (RLS de `transactions` ya lo protegerá gracias al `EXISTS` contra `cash_sessions`, ver `decisiones.md`).
4. **Formato Numérico y Moneda:** El precio de producto y el monto de transacción deben enviarse como enteros al backend. El componente del cliente transformará la máscara a números planos antes de disparar el Server Action.
