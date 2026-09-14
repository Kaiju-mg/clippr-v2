# Especificación: Infraestructura Base, Auth y Multi-Tenant

Esta especificación detalla la implementación de la primera rebanada vertical del backlog. Sienta las bases de la aplicación, el modelo multi-tenant (barberías aisladas) y la autenticación.

## 1. Base de Datos (Supabase)

### 1.1 Tablas y Modelo
- **`barbershops`**: 
  - Columnas: `id` (UUID, Primary Key), `name` (Texto), `subscription_plan` (Texto: trial/pro/team), `created_at` (Timestamp).
- **`users`**:
  - Columnas: `id` (UUID, Primary Key), `auth_id` (UUID, Foreign Key a `auth.users` de Supabase, Unique), `barbershop_id` (UUID, Foreign Key a `barbershops`), `role` (Texto: owner, barber, independent), `name` (Texto), `level` (Texto), `commission_pct` (Numérico), `streak_count` (Entero), `created_at` (Timestamp).

### 1.2 Row Level Security (RLS)
La seguridad multi-tenant se resuelve en la base de datos, no en el código de la aplicación.
- Habilitar RLS en `barbershops` y `users`.
- Política para `barbershops`: Un usuario solo puede hacer SELECT/UPDATE en la fila donde su `auth.uid()` esté asociado a un registro en la tabla `users` que tenga ese mismo `barbershop_id`.
- Política para `users`: Un usuario solo puede hacer SELECT/INSERT/UPDATE en las filas que tengan el mismo `barbershop_id` que su propio usuario.

## 2. Server Actions (Lógica de Negocio)

**Archivos a tocar:** `src/actions/auth.actions.ts`

- **`registerOwnerAction(data)`:**
  - Recibe: Email, Contraseña, Nombre del Dueño, Nombre de la Barbería.
  - Flujo: 
    1. Llama a `supabase.auth.signUp()`.
    2. Si es exitoso, invoca una transacción (o un Stored Procedure/RPC en Supabase) para asegurar atomicidad: crear el registro en `barbershops` y luego el registro en `users` (con `role = 'owner'`).
- **`loginAction(data)`:**
  - Invoca `supabase.auth.signInWithPassword()`.
- **`logoutAction()`:**
  - Invoca `supabase.auth.signOut()`.
  - Redirige a `/login`.

## 3. UI y Componentes (Next.js App Router)

**Archivos a tocar:**
- **`src/app/layout.tsx` & `public/manifest.json`:**
  - Validar que los metadatos básicos de PWA estén configurados (`themeColor`, enlaces a iconos del manifest).
- **`src/app/(auth)/login/page.tsx`:**
  - Formulario de login (email, contraseña) y botón de submit que invoca `loginAction`.
  - Enlace hacia registro.
- **`src/app/(auth)/registro/page.tsx`:**
  - Formulario de registro (nombre de la barbería, nombre del usuario, email, contraseña).
- **`src/app/(dashboard)/layout.tsx`:**
  - Chequeo de sesión del lado del servidor: usar `supabase.auth.getUser()`. Si no hay sesión válida, redirigir inmediatamente a `/login`.
  - Renderizar una Navbar básica (Mobile First) que incluya el nombre de la barbería actual y un botón/menú para cerrar sesión.

## 4. Tests y Validaciones

**Archivos a tocar:** `src/app/(auth)/__tests__/auth.test.ts` (Vitest + Testing Library)
- **UI Tests:**
  - Validar renderizado de formularios y estados de carga (botones deshabilitados durante la petición).
  - Validar que se muestren mensajes de error si los Server Actions devuelven fallos (ej. "Contraseña muy corta").
- **Flujo de Negocio (Integration):**
  - Simular el submit del formulario de registro y afirmar que el Server Action fue llamado con los datos correctos.
  
## 5. Casos Borde y Riesgos a Mitigar

1. **Atomicidad en el Registro (Race Conditions / Inconsistencias):**
   - *Problema:* El registro requiere escribir en `auth.users` (gestionado por Supabase) y luego en nuestras tablas públicas `barbershops` y `users`. Si el segundo paso falla, quedará un usuario de Auth "fantasma" sin barbería.
   - *Solución:* Usar un Database Trigger en Supabase (`AFTER INSERT ON auth.users`) para crear el perfil básico, o empaquetar la creación de `barbershop` y `user` en una función RPC (Procedimiento Almacenado de Postgres) a la cual llamar tras obtener el éxito de `signUp`. Priorizar simplicidad: para esta rebanada un Server Action con manejo de errores o un RPC es suficiente.
2. **Duplicación de Emails:**
   - Supabase Auth maneja esto devolviendo un error específico. La UI debe atrapar este error en el `registerOwnerAction` y devolver un mensaje amigable ("Este correo ya está registrado") al cliente.
3. **Pérdida de Sesión:**
   - Asegurarse de usar correctamente `@supabase/ssr` en el cliente (`src/lib/supabase/client.ts`) para mantener sincronizada la cookie de sesión si el token se refresca.
