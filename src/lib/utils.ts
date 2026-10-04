/**
 * Funciones utilitarias generales. Sin lógica de negocio.
 */

/** Une clases condicionales descartando falsy. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const amountFormatter = new Intl.NumberFormat("es-PY", {
  maximumFractionDigits: 0,
});

/**
 * Un monto sin "Gs.": "400.000". Para los renglones del ticket, donde la
 * moneda va una sola vez, en el TOTAL (spec 10).
 */
export function formatAmount(amount: number): string {
  return amountFormatter.format(amount);
}

/** Formatea un monto en guaraníes (sin decimales, el PYG no usa centavos). */
export function formatGuaranies(amount: number): string {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    maximumFractionDigits: 0,
  }).format(amount);
}
