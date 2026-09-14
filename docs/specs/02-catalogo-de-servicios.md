# Spec: 02 - Catálogo de Servicios

## 1. Descripción
Implementación de la segunda rebanada vertical: Catálogo de Servicios. Permitirá a los dueños y barberos crear, leer, actualizar y borrar (CRUD) los servicios ofrecidos en su barbería (ej. "Corte Clásico", "Barba"). Incluye la capacidad de activar/desactivar servicios para gestionar promociones o pausas temporales.

## 2. Archivos a crear / modificar

### Base de Datos & Migraciones
- `supabase/migrations/XXXXXXXXXXXXXX_create_services_table.sql`: Script de creación de la tabla `services`, habilitación de RLS, y definición de políticas usando `public.current_barbershop_id()`.
- (Si es necesario) `src/types/index.ts`: Actualizar o verificar que la interfaz `Service` exista y esté alineada con el schema.

### Backend / Server Actions
- `src/actions/service.actions.ts`: Aquí residirán las mutaciones y consultas, asegurando que la lógica de negocio se ejecuta en el servidor.
- `src/actions/__tests__/service.test.ts`: Pruebas (Vitest) para validar las operaciones y reglas de negocio.

### Interfaz de Usuario (UI)
- `src/app/(dashboard)/servicios/page.tsx`: Página principal del catálogo de servicios. Server Component que obtiene los servicios y renderiza el Client Component.
- `src/app/(dashboard)/servicios/_components/ServiceList.tsx`: Componente para mostrar y gestionar la lista. **Debe incluir un "Switch" (Toggle) visual para activar/desactivar cada servicio rápidamente.**
- `src/app/(dashboard)/servicios/_components/ServiceFormModal.tsx`: Modal para crear o editar. Utilizar diseño tipo "Bottom Sheet" (flotante desde abajo) para mobile.
- `src/components/ui/*`: Componentes base (Inputs, Botones, Modales, Switch) a reutilizar, siguiendo una estética limpia, blanca y minimalista.

## 3. Modelo de Datos
Entidad `Service` (según `docs/arquitectura.md` con adición de estado):
- `id` (UUID, Primary Key)
- `barbershop_id` (UUID, referencia a `barbershops`)
- `name` (String, no nulo)
- `price` (Numeric / Decimal, no nulo)
- `duration_minutes` (Integer, no nulo, ej. default 30)
- `is_active` (Boolean, no nulo, default true) - Permite ocultar servicios temporalmente (ej. para la "Promo Martes").

## 4. Endpoints / Server Actions
- `getServicesAction()`: Consulta y devuelve la lista de servicios. RLS filtra automáticamente por el `barbershop_id`.
- `createServiceAction(data: ServicePayload)`: Inserta un nuevo servicio en la base de datos.
- `updateServiceAction(id: string, data: Partial<ServicePayload>)`: Actualiza un servicio existente.
- `toggleServiceStatusAction(id: string, newStatus: boolean)`: Acción rápida dedicada para el switch de la UI que activa o desactiva un servicio.
- `deleteServiceAction(id: string)`: Borrado del servicio.

## 5. Casos Borde y Consideraciones

- **Seguridad Multi-Tenant (RLS):** Escudado por RLS.
- **Validación de Datos:** Garantizar que `price` y `duration_minutes` sean valores positivos.
- **Soft Delete y Visibilidad:** Al tener el campo `is_active`, en lugar de borrar un servicio físicamente (lo cual podría romper el historial de turnos pasados), se recomienda simplemente poner `is_active = false`.
- **Experiencia de Usuario (UI Optimista):** Al tocar el Switch de Activar/Desactivar, usar `useOptimistic` de React 19 para que el botón cambie al instante, mientras la petición viaja por la red. Esto es clave para dar sensación de rapidez si el internet es inestable.
- **Cache:** Tras ejecutar acciones, llamar a `revalidatePath('/servicios')`.

## 6. Plan de Pruebas (Test)
- **Aislamiento de Tenant (RLS):** Verificar que la Barbería A no ve los de la B.
- **Toggle de Estado:** Probar que `toggleServiceStatusAction` cambia el estado correctamente.
- **Validaciones:** Precios negativos son rechazados.
