/**
 * Fechas del negocio en la zona horaria de la barbería. El servidor (Vercel)
 * corre en UTC y el celular del barbero puede tener mal configurada la zona,
 * así que "qué día es" y "a qué instante corresponde las 21:30" se resuelven
 * siempre acá, nunca con `new Date()` pelado. Fija para todo el MVP (todas las
 * barberías están en Paraguay); si hubiera otros países, pasa a ser una
 * columna de `barbershops`.
 */
export const BUSINESS_TIMEZONE = "America/Asuncion";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateISO(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zonedParts(instant: Date) {
  const parts = Object.fromEntries(
    partsFormatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return parts as Record<
    "year" | "month" | "day" | "hour" | "minute" | "second",
    number
  >;
}

/** Diferencia (ms) entre la hora de pared en la zona del negocio y UTC. */
function offsetMs(instant: Date): number {
  const p = zonedParts(instant);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Día calendario (YYYY-MM-DD) de un instante, en la zona del negocio. */
export function businessDateOf(instant: Date): string {
  const p = zonedParts(instant);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function businessToday(now: Date = new Date()): string {
  return businessDateOf(now);
}

/** Instante UTC que corresponde a `dateISO` + `time` (HH:MM) en la zona del negocio. */
export function businessDateTimeToUtc(dateISO: string, time: string): Date {
  const [year, month, day] = dateISO.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Dos pasadas: la primera estima el offset, la segunda lo corrige si el
  // instante cae del otro lado de un cambio de horario.
  let result = wallAsUtc - offsetMs(new Date(wallAsUtc));
  result = wallAsUtc - offsetMs(new Date(result));
  return new Date(result);
}

/** Suma días a una fecha calendario, sin pasar por ninguna zona horaria. */
export function shiftDateISO(dateISO: string, deltaDays: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return date.toISOString().slice(0, 10);
}

/** Rango [inicio, inicio del día siguiente) del día pedido, en UTC. */
export function businessDayRangeUtc(dateISO: string): {
  start: string;
  end: string;
} {
  return {
    start: businessDateTimeToUtc(dateISO, "00:00").toISOString(),
    end: businessDateTimeToUtc(shiftDateISO(dateISO, 1), "00:00").toISOString(),
  };
}
