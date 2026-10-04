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
  const wallAsUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
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

/**
 * Días calendario entre dos fechas (`b - a`), sin pasar por ninguna zona
 * horaria: las dos son días del negocio ya resueltos, no instantes. Se usa
 * para la racha (¿la última caja fue ayer, anteayer o hace una semana?).
 */
export function daysBetweenDateISO(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.round((end - start) / 86_400_000);
}

/**
 * Lunes de la semana a la que pertenece `dateISO`. La semana del negocio
 * arranca el lunes: el domingo es el día de menos movimiento en una
 * barbería, así que cortar ahí parte el fin de semana al medio.
 */
export function businessWeekStart(dateISO: string): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  // getUTCDay(): 0 = domingo. El domingo cierra la semana que empezó el
  // lunes anterior, no abre una nueva.
  const backToMonday = weekday === 0 ? 6 : weekday - 1;
  return shiftDateISO(dateISO, -backToMonday);
}

/** Primer día del mes al que pertenece `dateISO`. */
export function businessMonthStart(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}

/** Rango [inicio del primer día, inicio del día siguiente al último) en UTC. */
export function businessRangeUtc(
  startDateISO: string,
  endDateISO: string,
): { start: string; end: string } {
  return {
    start: businessDayRangeUtc(startDateISO).start,
    end: businessDayRangeUtc(endDateISO).end,
  };
}

/* ---------------------------------------------------------------------------
 * Formateo para pantalla. Vive acá, con el resto de las fechas del negocio,
 * para que ninguna pantalla vuelva a armar su propio `Intl.DateTimeFormat`
 * con la zona puesta a mano (había uno repetido en la agenda y otro en la
 * caja).
 * ------------------------------------------------------------------------- */

// Un día calendario no es un instante: se formatea en UTC a propósito, para
// que ninguna zona horaria lo corra de día.
const dateLabelFormatter = new Intl.DateTimeFormat("es-PY", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "Sábado, 20 de septiembre" — etiqueta de un día calendario. */
export function formatBusinessDateLabel(dateISO: string): string {
  const label = dateLabelFormatter.format(new Date(`${dateISO}T00:00:00.000Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// `hourCycle: "h23"` explícito: `es-PY` sale en 12 horas ("04:30 p. m."),
// que no entra en la columna de horas en mono (spec 10).
const timeFormatter = new Intl.DateTimeFormat("es-PY", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: BUSINESS_TIMEZONE,
});

/** "15:30" — hora de pared de un instante, en la zona del negocio. */
export function formatBusinessTime(instantISO: string): string {
  return timeFormatter.format(new Date(instantISO));
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-PY", {
  dateStyle: "short",
  timeStyle: "short",
  hourCycle: "h23",
  timeZone: BUSINESS_TIMEZONE,
});

/** Fecha y hora cortas de un instante, en la zona del negocio. */
export function formatBusinessDateTime(instantISO: string): string {
  return dateTimeFormatter.format(new Date(instantISO));
}

const ticketFormatter = new Intl.DateTimeFormat("es-PY", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: BUSINESS_TIMEZONE,
});

/**
 * "Sáb 03/10/2026 · 21:05" — el renglón de fecha del ticket (spec 10). Se
 * arma por partes para no depender de la puntuación que elija `Intl`
 * ("sáb." o "sáb", coma antes de la hora).
 */
export function formatTicketDateTime(instantISO: string): string {
  const parts = Object.fromEntries(
    ticketFormatter
      .formatToParts(new Date(instantISO))
      .map((part) => [part.type, part.value]),
  );
  const weekday = (parts.weekday ?? "").replace(".", "");
  const dia = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${dia} ${parts.day}/${parts.month}/${parts.year} · ${parts.hour}:${parts.minute}`;
}

const shareDateFormatter = new Intl.DateTimeFormat("es-PY", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: BUSINESS_TIMEZONE,
});

/**
 * "Sábado 03/10/2026" — la fecha de la imagen para compartir el día (spec 10,
 * fase 3). Sin hora: es "el día", no el momento del cierre. Por partes, igual
 * que `formatTicketDateTime`.
 */
export function formatShareDate(instantISO: string): string {
  const parts = Object.fromEntries(
    shareDateFormatter
      .formatToParts(new Date(instantISO))
      .map((part) => [part.type, part.value]),
  );
  const weekday = parts.weekday ?? "";
  const dia = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${dia} ${parts.day}/${parts.month}/${parts.year}`;
}

const monthLabelFormatter = new Intl.DateTimeFormat("es-PY", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "Septiembre 2026" — el mes de un día calendario (ticket del mes). */
export function formatMonthLabel(dateISO: string): string {
  const label = monthLabelFormatter
    .format(new Date(`${dateISO}T00:00:00.000Z`))
    .replace(" de ", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const shortDayFormatter = new Intl.DateTimeFormat("es-PY", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

/** "Sáb 12/09" — un día calendario corto, para un renglón del ticket. */
export function formatShortDay(dateISO: string): string {
  const parts = Object.fromEntries(
    shortDayFormatter
      .formatToParts(new Date(`${dateISO}T00:00:00.000Z`))
      .map((part) => [part.type, part.value]),
  );
  const weekday = (parts.weekday ?? "").replace(".", "");
  const dia = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${dia} ${parts.day}/${parts.month}`;
}
