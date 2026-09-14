# Spec: 03 - Gestión del Equipo (Barberos)

## 1. Descripción
Implementación de la tercera rebanada vertical: Gestión del Equipo. Permite al usuario con rol de Dueño (`owner`) crear perfiles para sus empleados, asignándoles un rol, un nivel de experiencia y un porcentaje de comisión. Esta rebanada es un paso previo obligatorio para poder asignar turnos a barberos específicos y para que cada uno pueda abrir su propia caja.

## 2. Archivos a crear / modificar

### Base de Datos & Permisos
- La tabla `users` ya fue creada en la Spec 01 (Auth). Solo hay que asegurarse de que las políticas RLS permitan al Dueño hacer un `INSERT` en `users` para su misma `barbershop_id`.
- `.env.local`: Será necesario agregar `SUPABASE_SERVICE_ROLE_KEY` si se usa la Admin API para crear los usuarios de Auth desde el servidor.

### Backend / Server Actions
- `src/lib/supabase/admin.ts`: Un nuevo cliente de Supabase instanciado con el `SERVICE_ROLE_KEY`. Se usa **exclusivamente** en el backend para crear usuarios de Auth (los barberos) sin necesidad de que el dueño cierre su sesión.
- `src/actions/team.actions.ts`: Acciones de servidor (`getTeamAction`, `createBarberAction`, `updateBarberAction`).
- `src/actions/__tests__/team.test.ts`: Pruebas de los Server Actions, testeando especialmente que un barbero no pueda invitar a otro barbero (Control de Accesos).

### Interfaz de Usuario (UI)
- `src/app/(dashboard)/equipo/page.tsx`: Server Component que obtiene la lista del equipo y verifica si el usuario actual es dueño para mostrar u ocultar el botón de "Agregar Barbero".
- `src/app/(dashboard)/equipo/_components/TeamList.tsx`: Lista de barberos (Client Component). Diseño limpio, sin "cards" pesadas. Solo nombre, nivel (badge minimalista) y comisión.
- `src/app/(dashboard)/equipo/_components/BarberInlineForm.tsx`: Formulario "in-place" (fila expandible) para crear o editar barberos, siguiendo **estrictamente el mismo patrón visual usado en el catálogo de servicios**. No se deben usar modales ni bottom-sheets.

## 3. Modelo de Datos
Entidad `User` (ya definida en `docs/arquitectura.md`):
- `id` (UUID, Primary Key de la tabla pública)
- `auth_id` (UUID, referencia a `auth.users` de Supabase)
- `barbershop_id` (UUID, heredado automáticamente del dueño que lo crea)
- `role` (Enum/String: 'owner', 'barber', 'independent')
- `name` (String)
- `level` (Enum/String: 'junior', 'pro', 'senior', 'elite')
- `commission_pct` (Numeric, porcentaje de comisión)
- `streak_count` (Integer, default 0)

## 4. Endpoints / Server Actions

- `getTeamAction()`: Devuelve todos los usuarios que comparten el `barbershop_id` del usuario autenticado.
- `createBarberAction(data)`:
  1. **Autorización:** Verifica que el usuario ejecutando la acción tenga `role === 'owner'`.
  2. **Auth:** Usa `supabase.auth.admin.createUser()` para crear la cuenta de login del barbero usando el cliente Admin.
  3. **Perfil:** Inserta el registro en la tabla pública `users`.
- `updateBarberAction(id, data)`: Modifica el nivel o la comisión de un barbero. También requiere validación de rol `owner`.

## 5. Casos Borde y Consideraciones

- **Control de Acceso Basado en Roles (RBAC):** RLS aísla la Barbería A de la Barbería B. Pero *dentro* de la Barbería A, el Server Action debe validar que el que llama a la acción sea un `owner`.
- **Creación de Cuentas (Auth):** Al crear un barbero, hacer `supabase.auth.signUp()` cerraría la sesión del dueño. Por eso se requiere usar `supabase.auth.admin.createUser` en el servidor con el cliente de Admin.
- **Correos Duplicados:** La UI debe atajar los errores si el correo ya existe.
- **UI Consistente:** Mantener el uso de formularios in-line expandibles para evitar reintroducir el patrón descartado de modales/overlays.

## 6. Plan de Pruebas (Test)
- **Aislamiento de Tenant (RLS):** Verificar que `getTeamAction()` no devuelve empleados de otras barberías.
- **Autorización de Roles:** Validar que un usuario con `role === 'barber'` no pueda ejecutar `updateBarberAction`.
