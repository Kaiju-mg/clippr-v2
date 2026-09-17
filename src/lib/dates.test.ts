import { describe, expect, it } from "vitest";
import {
  businessDateOf,
  businessDateTimeToUtc,
  businessDayRangeUtc,
  businessMonthStart,
  businessRangeUtc,
  businessToday,
  businessWeekStart,
  daysBetweenDateISO,
  isValidDateISO,
  isValidTime,
  shiftDateISO,
} from "./dates";

describe("dates (America/Asuncion)", () => {
  it("un turno a las 21:30 cae en el mismo día de Paraguay aunque en UTC ya sea el siguiente", () => {
    const instant = businessDateTimeToUtc("2026-09-16", "21:30");

    expect(instant.toISOString()).toBe("2026-09-17T00:30:00.000Z");
    expect(businessDateOf(instant)).toBe("2026-09-16");
  });

  it("el rango del día va de 00:00 a 00:00 del día siguiente, hora de Paraguay", () => {
    expect(businessDayRangeUtc("2026-09-16")).toEqual({
      start: "2026-09-16T03:00:00.000Z",
      end: "2026-09-17T03:00:00.000Z",
    });
  });

  it("a las 22:00 de Paraguay 'hoy' sigue siendo el mismo día (en UTC ya es mañana)", () => {
    expect(businessToday(new Date("2026-09-17T01:00:00.000Z"))).toBe(
      "2026-09-16",
    );
  });

  it("shiftDateISO cruza fin de mes y de año", () => {
    expect(shiftDateISO("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDateISO("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("valida fechas y horas", () => {
    expect(isValidDateISO("2026-09-16")).toBe(true);
    expect(isValidDateISO("2026-02-30")).toBe(false);
    expect(isValidDateISO("16-09-2026")).toBe(false);
    expect(isValidTime("21:30")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("9:30")).toBe(false);
  });
});

describe("rangos de la spec 08", () => {
  it("cuenta los días calendario entre dos fechas", () => {
    expect(daysBetweenDateISO("2026-09-16", "2026-09-17")).toBe(1);
    expect(daysBetweenDateISO("2026-09-15", "2026-09-17")).toBe(2);
    expect(daysBetweenDateISO("2026-09-17", "2026-09-17")).toBe(0);
    expect(daysBetweenDateISO("2026-09-30", "2026-10-01")).toBe(1);
    expect(daysBetweenDateISO("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("la semana del negocio arranca el lunes y el domingo la cierra", () => {
    // 2026-09-17 es jueves.
    expect(businessWeekStart("2026-09-17")).toBe("2026-09-14");
    // Lunes: se queda donde está.
    expect(businessWeekStart("2026-09-14")).toBe("2026-09-14");
    // Domingo 20/09: pertenece a la semana que arrancó el lunes 14.
    expect(businessWeekStart("2026-09-20")).toBe("2026-09-14");
  });

  it("el mes arranca el día 1", () => {
    expect(businessMonthStart("2026-09-17")).toBe("2026-09-01");
    expect(businessMonthStart("2026-01-31")).toBe("2026-01-01");
  });

  it("un rango de varios días va del 00:00 del primero al 00:00 del siguiente al último", () => {
    expect(businessRangeUtc("2026-09-14", "2026-09-17")).toEqual({
      start: "2026-09-14T03:00:00.000Z",
      end: "2026-09-18T03:00:00.000Z",
    });
  });
});
