/**
 * La línea de resumen arriba de un catálogo (`/servicios`, `/productos`):
 * "3 activos · 1 pausado · 2 agotados". Las listas son el patrón oficial de
 * los catálogos (decisión del 2026-10-04); esta línea les da el dato que en
 * un tablero daría un cubo, sin convertirlas en una grilla.
 */
interface CatalogCounts {
  active: number;
  paused: number;
  /** Sólo productos: con stock 0, estén activos o no. */
  soldOut?: number;
}

function plural(count: number, singular: string, pluralWord: string) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

export function catalogSummary({
  active,
  paused,
  soldOut = 0,
}: CatalogCounts): string {
  const parts = [plural(active, "activo", "activos")];
  if (paused > 0) parts.push(plural(paused, "pausado", "pausados"));
  if (soldOut > 0) parts.push(plural(soldOut, "agotado", "agotados"));
  return parts.join(" · ");
}
