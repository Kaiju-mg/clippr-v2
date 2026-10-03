import { describe, expect, it } from "vitest";
import {
  nextStreakCount,
  nextStreakTier,
  streakStatus,
  streakTier,
  visibleStreak,
} from "./streaks";

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

describe("streakStatus — cómo se ve el poste hoy", () => {
  it("viva si la última jornada fue hoy o ayer", () => {
    expect(streakStatus(5, "2026-09-17", HOY)).toBe("activa");
    expect(streakStatus(5, "2026-09-16", HOY)).toBe("activa");
  });

  it("en peligro si fue anteayer (el día de gracia)", () => {
    expect(streakStatus(5, "2026-09-15", HOY)).toBe("en_peligro");
  });

  it("apagada con más de un día salteado", () => {
    expect(streakStatus(5, "2026-09-14", HOY)).toBe("apagada");
  });

  it("apagada si nunca hubo racha o no hay jornadas", () => {
    expect(streakStatus(0, "2026-09-17", HOY)).toBe("apagada");
    expect(streakStatus(5, null, HOY)).toBe("apagada");
  });

  it("es coherente con nextStreakCount: en peligro todavía suma, apagada reinicia", () => {
    expect(nextStreakCount(5, "2026-09-15", HOY, false)).toBe(6);
    expect(nextStreakCount(5, "2026-09-14", HOY, false)).toBe(1);
  });
});

describe("visibleStreak", () => {
  it("una racha apagada se muestra en 0", () => {
    expect(visibleStreak(12, "apagada")).toBe(0);
    expect(visibleStreak(12, "en_peligro")).toBe(12);
  });
});

describe("streakTier — niveles del poste", () => {
  it("acero hasta 6, oro de 7 a 29, encendido desde 30", () => {
    expect(streakTier(0)).toBe("acero");
    expect(streakTier(6)).toBe("acero");
    expect(streakTier(7)).toBe("oro");
    expect(streakTier(29)).toBe("oro");
    expect(streakTier(30)).toBe("encendido");
  });

  it("dice cuánto falta para el siguiente", () => {
    expect(nextStreakTier(4)).toEqual({ tier: "oro", daysLeft: 3 });
    expect(nextStreakTier(12)).toEqual({ tier: "encendido", daysLeft: 18 });
    expect(nextStreakTier(45)).toBeNull();
  });
});
