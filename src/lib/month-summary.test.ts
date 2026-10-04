import { describe, expect, it } from "vitest";
import {
  bestDay,
  longestStreak,
  showsMonthTicket,
  summarizeMonth,
} from "./month-summary";

describe("showsMonthTicket", () => {
  it("sólo del 1 al 7 del mes", () => {
    expect(showsMonthTicket("2026-10-01")).toBe(true);
    expect(showsMonthTicket("2026-10-07")).toBe(true);
    expect(showsMonthTicket("2026-10-08")).toBe(false);
    expect(showsMonthTicket("2026-10-31")).toBe(false);
  });
});

describe("longestStreak — misma regla del día de gracia", () => {
  it("días seguidos suman", () => {
    expect(longestStreak(["2026-09-01", "2026-09-02", "2026-09-03"])).toBe(3);
  });

  it("un día salteado no corta (el día de gracia)", () => {
    expect(longestStreak(["2026-09-01", "2026-09-03", "2026-09-05"])).toBe(3);
  });

  it("dos días salteados cortan y la racha vuelve a 1", () => {
    expect(
      longestStreak([
        "2026-09-01",
        "2026-09-02",
        "2026-09-05", // tres días después: se cortó
        "2026-09-06",
        "2026-09-07",
        "2026-09-08",
      ]),
    ).toBe(4);
  });

  it("el mismo día dos veces (dos cajas) cuenta una, y el orden no importa", () => {
    expect(longestStreak(["2026-09-03", "2026-09-02", "2026-09-02"])).toBe(2);
  });

  it("sin días trabajados, 0", () => {
    expect(longestStreak([])).toBe(0);
  });
});

describe("bestDay", () => {
  it("el día con más cortes; a igual cantidad, el primero", () => {
    const corte = (dateISO: string) => ({ dateISO, serviceName: "Corte" });
    expect(
      bestDay([
        corte("2026-09-12"),
        corte("2026-09-05"),
        corte("2026-09-12"),
        corte("2026-09-05"),
        corte("2026-09-20"),
      ]),
    ).toEqual({ dateISO: "2026-09-05", cuts: 2 });
  });

  it("sin cortes, null", () => {
    expect(bestDay([])).toBeNull();
  });
});

describe("summarizeMonth", () => {
  it("junta cortes, servicio más pedido, mejor día, racha más larga y lo cobrado", () => {
    const month = summarizeMonth(
      "2026-09-01",
      [
        { dateISO: "2026-09-12", serviceName: "Corte clásico" },
        { dateISO: "2026-09-12", serviceName: "Corte clásico" },
        { dateISO: "2026-09-13", serviceName: "Barba" },
      ],
      ["2026-09-12", "2026-09-13"],
      150000,
    );
    expect(month).toEqual({
      monthStartISO: "2026-09-01",
      cuts: 3,
      topService: { name: "Corte clásico", count: 2 },
      bestDay: { dateISO: "2026-09-12", cuts: 2 },
      longestStreak: 2,
      income: 150000,
    });
  });
});
