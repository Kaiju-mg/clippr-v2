/**
 * Identificadores aleatorios para el cliente (hoy: los timers de Zustand).
 *
 * No usa `crypto.randomUUID()` a secas porque **esa función sólo existe en
 * contextos seguros**: HTTPS o `localhost`. Servido por IP con HTTP plano
 * —que es exactamente cómo se prueba la app desde un celular en la misma
 * red— `crypto.randomUUID` queda `undefined` y la llamada tira
 * `TypeError: crypto.randomUUID is not a function`. En el caso del timer eso
 * reventaba el handler antes de crear nada: el barbero tocaba "Iniciar corte"
 * y no pasaba absolutamente nada, sin mensaje de error (encontrado probando
 * desde un celular el 2026-09-20).
 *
 * `crypto.getRandomValues`, en cambio, **no** está restringido a contextos
 * seguros, así que sirve de respaldo con la misma calidad de aleatoriedad.
 */

/** UUID v4 armado a mano desde bytes aleatorios (RFC 4122, sección 4.4). */
function uuidV4FromBytes(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Los dos nibbles que marcan versión (4) y variante (RFC 4122).
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/**
 * UUID v4. Usa `crypto.randomUUID()` cuando está (producción sobre HTTPS y
 * desarrollo en `localhost`) y cae al respaldo en cualquier otro origen.
 */
export function randomId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return uuidV4FromBytes();
}
