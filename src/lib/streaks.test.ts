import { describe, expect, it } from "vitest";
import { nextStreakCount } from "./streaks";

const HOY = "2026-09-17";

describe("nextStreakCount — racha con día de gracia", () => {
  it("la primera jornada arranca la racha en 1", () => {
    expect(nextStreakCount(0, null, HOY, false)).toBe(1);
  });

  it("trabajar ayer suma un día", () => {
    expect(nextStreakCount(5, "2026-09-16", HOY, false)).toBe(6);
  });

  it("un hueco de un día (anteayer) no rompe la racha: es el día de gracia", () => {
    expect(nextStreakCount(5, "2026-09-15", HOY, false)).toBe(6);
  });

  it("tres días o más sin caja rompen la racha y vuelve a 1", () => {
    expect(nextStreakCount(60, "2026-09-14", HOY, false)).toBe(1);
    expect(nextStreakCount(60, "2026-03-01", HOY, false)).toBe(1);
  });

  it("una segunda caja el mismo día no suma dos veces", () => {
    expect(nextStreakCount(5, "2026-09-16", HOY, true)).toBe(5);
  });

  it("cruza fin de mes sin perder la cuenta", () => {
    expect(nextStreakCount(3, "2026-08-31", "2026-09-01", false)).toBe(4);
    expect(nextStreakCount(3, "2026-08-30", "2026-09-01", false)).toBe(4);
    expect(nextStreakCount(3, "2026-08-29", "2026-09-01", false)).toBe(1);
  });

  it("nunca devuelve 0 ni valores negativos con datos raros", () => {
    expect(nextStreakCount(-3, null, HOY, false)).toBe(1);
    expect(nextStreakCount(0, "2026-09-16", HOY, true)).toBe(1);
    // lastWorkedDate posterior a hoy no debería pasar; si pasa, no se
    // castiga al barbero.
    expect(nextStreakCount(4, "2026-09-18", HOY, false)).toBe(4);
  });
});
