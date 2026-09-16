import { describe, expect, it } from "vitest";
import {
  businessDateOf,
  businessDateTimeToUtc,
  businessDayRangeUtc,
  businessToday,
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
