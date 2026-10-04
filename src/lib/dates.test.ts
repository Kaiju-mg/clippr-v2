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
  formatBusinessDateLabel,
  formatBusinessDateTime,
  formatBusinessTime,
  formatMonthLabel,
  formatShareDate,
  formatShortDay,
  formatTicketDateTime,
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

describe("formateo para pantalla", () => {
  it("la etiqueta de un día no se corre de día por la zona horaria", () => {
    // Si el día calendario se formateara en America/Asuncion en vez de en
    // UTC, "2026-09-20T00:00:00Z" caería el 19 a las 21:00 y la cabecera
    // mostraría el día anterior.
    expect(formatBusinessDateLabel("2026-09-20")).toBe(
      "Domingo, 20 de septiembre",
    );
    expect(formatBusinessDateLabel("2026-01-01")).toBe("Jueves, 1 de enero");
  });

  it("la hora de un turno se muestra en la zona del negocio", () => {
    // 00:30 UTC del 17 son las 21:30 del 16 en Paraguay (UTC−3).
    expect(formatBusinessTime("2026-09-17T00:30:00.000Z")).toBe("21:30");
  });

  it("la hora va en 24 horas, sin a. m./p. m. (columna fija en mono)", () => {
    // 12:05 UTC son las 09:05 en Paraguay: con cero adelante y sin sufijo.
    expect(formatBusinessTime("2026-09-17T12:05:00.000Z")).toBe("09:05");
    expect(formatBusinessDateTime("2026-09-17T00:30:00.000Z")).not.toMatch(
      /[ap]\.\s?m\./,
    );
    expect(formatBusinessDateTime("2026-09-17T00:30:00.000Z")).toContain(
      "21:30",
    );
  });
});

describe("formatTicketDateTime", () => {
  it("día abreviado, fecha y hora del negocio, como en el ticket", () => {
    // 00:05 UTC del 4 de octubre son las 21:05 del sábado 3 en Paraguay.
    expect(formatTicketDateTime("2026-10-04T00:05:00.000Z")).toBe(
      "Sáb 03/10/2026 · 21:05",
    );
  });

  it("la hora va en 24 horas y con cero adelante", () => {
    expect(formatTicketDateTime("2026-10-05T12:07:00.000Z")).toBe(
      "Lun 05/10/2026 · 09:07",
    );
  });
});

describe("formatShareDate", () => {
  it("día completo y fecha del negocio, sin hora (la imagen es del día)", () => {
    // 00:05 UTC del 4 de octubre todavía es el sábado 3 en Paraguay.
    expect(formatShareDate("2026-10-04T00:05:00.000Z")).toBe(
      "Sábado 03/10/2026",
    );
    expect(formatShareDate("2026-10-04T15:00:00.000Z")).toBe(
      "Domingo 04/10/2026",
    );
  });
});

describe("formatMonthLabel y formatShortDay (ticket del mes)", () => {
  it("'Septiembre 2026', sin el 'de' de Intl", () => {
    expect(formatMonthLabel("2026-09-01")).toBe("Septiembre 2026");
    expect(formatMonthLabel("2026-12-31")).toBe("Diciembre 2026");
  });

  it("'Sáb 12/09': día corto de un día calendario, sin zona horaria", () => {
    expect(formatShortDay("2026-09-12")).toBe("Sáb 12/09");
    expect(formatShortDay("2026-10-04")).toBe("Dom 04/10");
  });
});
