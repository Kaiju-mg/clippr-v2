/**
 * Códigos SQLSTATE que los Server Actions traducen a mensajes en español.
 *
 * Los de clase `23` son de Postgres. Los de clase `CL` (libre, Postgres no la
 * usa) los levantan a propósito las funciones de
 * `20260920000000_atomic_charge_rpcs.sql` y de
 * `20260920010000_users_update_hardening.sql`: sin ellos, un error de negocio
 * dentro de un RPC llegaría acá como un 500 indistinguible de una caída de
 * red, y el barbero vería "Algo salió mal" cuando lo que pasa es que se le
 * acabó el stock.
 *
 * supabase-js expone el SQLSTATE en `error.code` y el `detail` del `raise` en
 * `error.details`.
 */

/** Violación de restricción única (ej. el índice one_open_session_per_user). */
export const UNIQUE_VIOLATION = "23505";
/** Violación de un `check` (ej. products.stock >= 0). */
export const CHECK_VIOLATION = "23514";

/** Caja inexistente, de otro barbero o ya cerrada. */
export const CAJA_INVALIDA = "CL001";
/** Servicio inexistente, de otro tenant o inactivo. */
export const SERVICIO_INVALIDO = "CL002";
/** `start_time` nulo o futuro. */
export const INICIO_INVALIDO = "CL003";
/** Turno inexistente, ajeno o que ya no está en `scheduled`. */
export const TURNO_INVALIDO = "CL004";
/** Producto inexistente, de otro tenant o inactivo. */
export const PRODUCTO_INVALIDO = "CL005";
/** Stock insuficiente. `message` trae el nombre y `details` el stock restante. */
export const STOCK_INSUFICIENTE = "CL006";
/** Turno de un día posterior a hoy: no se puede cobrar por adelantado. */
export const TURNO_FUTURO = "CL007";
/** No hay sesión autenticada (o el perfil de public.users no existe). */
export const SIN_SESION = "CL008";
/** Cantidad nula, cero o negativa. */
export const CANTIDAD_INVALIDA = "CL009";
/** El que ejecuta la acción no es el dueño de la barbería. */
export const NO_ES_DUENO = "CL010";
/** El usuario objetivo no existe o es de otra barbería. */
export const USUARIO_INVALIDO = "CL011";
