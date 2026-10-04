import { describe, expect, it } from "vitest";
import { shiftDateISO } from "./dates";
import {
  mondayOffset,
  monthEnd,
  stampCardDays,
  streakByDay,
} from "./stamp-card";

/** `n` días seguidos desde `from`. */
function seguidos(from: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDateISO(from, i));
}

describe("monthEnd", () => {
  it("último día de cada mes, con febrero y diciembre", () => {
    expect(monthEnd("2026-10-01")).toBe("2026-10-31");
    expect(monthEnd("2026-09-01")).toBe("2026-09-30");
    expect(monthEnd("2026-02-01")).toBe("2026-02-28");
    expect(monthEnd("2028-02-01")).toBe("2028-02-29");
    expect(monthEnd("2026-12-01")).toBe("2026-12-31");
  });
});

describe("mondayOffset", () => {
  it("columna del 1° en una semana de lunes a domingo", () => {
    expect(mondayOffset("2026-10-01")).toBe(3); // jueves
    expect(mondayOffset("2026-06-01")).toBe(0); // lunes
    expect(mondayOffset("2026-11-01")).toBe(6); // domingo
  });
});

describe("streakByDay", () => {
  it("racha al final de cada día, con el día de gracia", () => {
    const racha = streakByDay(["2026-10-01", "2026-10-03", "2026-10-07"]);
    expect([...racha.entries()]).toEqual([
      ["2026-10-01", 1],
      ["2026-10-03", 2],
      ["2026-10-07", 1],
    ]);
  });
});

describe("stampCardDays", () => {
  it("un casillero por día del mes, sellado si se trabajó", () => {
    const days = stampCardDays("2026-10-01", "2026-10-04", [
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(days).toHaveLength(31);
    expect(days.filter((d) => d.worked).map((d) => d.day)).toEqual([2, 3]);
    expect(days[3]).toMatchObject({ day: 4, isToday: true, isFuture: false });
    expect(days[4]).toMatchObject({ day: 5, isFuture: true });
  });

  it("el día en que la racha llega a 7 marca el poste de oro", () => {
    const days = stampCardDays(
      "2026-10-01",
      "2026-10-31",
      seguidos("2026-10-01", 8),
    );
    expect(
      days.filter((d) => d.milestone).map((d) => [d.day, d.milestone]),
    ).toEqual([[7, "oro"]]);
  });

  it("la racha que viene del mes anterior cuenta: el 30 cae donde corresponde", () => {
    // 25 días seguidos en septiembre + 10 en octubre: el día 30 de la racha
    // es el 5 de octubre, y el 7 quedó en septiembre (no se marca).
    const days = stampCardDays("2026-10-01", "2026-10-31", [
      ...seguidos("2026-09-06", 25),
      ...seguidos("2026-10-01", 10),
    ]);
    expect(
      days.filter((d) => d.milestone).map((d) => [d.day, d.milestone]),
    ).toEqual([[5, "encendido"]]);
    expect(days[0].streak).toBe(26);
  });

  it("los días trabajados de otros meses no aparecen en la grilla", () => {
    const days = stampCardDays("2026-10-01", "2026-10-15", ["2026-09-30"]);
    expect(days.some((d) => d.worked)).toBe(false);
  });
});
