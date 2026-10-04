/**
 * Datos de la imagen "Compartir el día" (spec 10, fase 3): la versión
 * cliente del ticket del cierre. Lo arma el servidor al cerrar la caja; el
 * cliente sólo lo dibuja (regla 1 de CLAUDE.md).
 */

export interface ServiceCount {
  name: string;
  count: number;
}

export interface ShareDay {
  barbershopName: string;
  /** null: la imagen no dibuja el renglón "Turnos: …". */
  phone: string | null;
  /** Cortes de la caja por servicio, del más pedido al menos pedido. */
  cutsByService: ServiceCount[];
}

/** Una fila de `appointments` con su servicio embebido. */
export interface CutRow {
  services: { name: string | null } | null;
}

const SIN_NOMBRE = "Corte";

/**
 * Agrupa los cortes cobrados por servicio: `Corte clásico x5`. Orden: más
 * pedidos primero; a igual cantidad, alfabético, para que la imagen salga
 * igual dos veces seguidas.
 */
export function countCutsByService(rows: readonly CutRow[]): ServiceCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.services?.name?.trim() || SIN_NOMBRE;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}
