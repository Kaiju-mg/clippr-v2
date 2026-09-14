/**
 * Funciones utilitarias generales. Sin lógica de negocio.
 */

/** Une clases condicionales descartando falsy. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Formatea un monto en guaraníes (sin decimales, el PYG no usa centavos). */
export function formatGuaranies(amount: number): string {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    maximumFractionDigits: 0,
  }).format(amount);
}
