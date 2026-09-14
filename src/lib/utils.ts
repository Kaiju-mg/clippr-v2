/**
 * Funciones utilitarias generales. Sin lógica de negocio.
 */

/** Une clases condicionales descartando falsy. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
