/** Mismo patrón que el `check` de la base (`barbershops_phone_format`). */
const PHONE_REGEX = /^[0-9 +()-]{6,25}$/;
const MIN_DIGITOS = 6;

/**
 * Normaliza el teléfono de la barbería que escribió el dueño (spec 10, fase
 * 3): espacios de más afuera y vacío = sin teléfono (`null`). Devuelve
 * `undefined` si no es válido.
 */
export function normalizePhone(raw: string): string | null | undefined {
  const phone = raw.trim().replace(/\s+/g, " ");
  if (phone.length === 0) return null;
  if (!PHONE_REGEX.test(phone)) return undefined;
  if (phone.replace(/\D/g, "").length < MIN_DIGITOS) return undefined;
  return phone;
}
