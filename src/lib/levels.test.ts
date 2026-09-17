import { describe, expect, it } from "vitest";
import { levelForCuts, levelProgress } from "./levels";

describe("levelForCuts — ligas de 30 días", () => {
  it("asigna el nivel según los cortes de la ventana", () => {
    expect(levelForCuts(0)).toBe("junior");
    expect(levelForCuts(39)).toBe("junior");
    expect(levelForCuts(40)).toBe("pro");
    expect(levelForCuts(90)).toBe("pro");
    expect(levelForCuts(91)).toBe("senior");
    expect(levelForCuts(150)).toBe("senior");
    expect(levelForCuts(151)).toBe("elite");
    expect(levelForCuts(9999)).toBe("elite");
  });

  it("el nivel baja si baja el rendimiento (es una liga, no un acumulado)", () => {
    expect(levelForCuts(160)).toBe("elite");
    // El mismo barbero, un mes flojo después.
    expect(levelForCuts(12)).toBe("junior");
  });
});

describe("levelProgress", () => {
  it("mide el avance dentro del tramo actual, no sobre el total", () => {
    // Recién ascendido a Pro (40): la barra arranca vacía en su tramo.
    const reciente = levelProgress(40);
    expect(reciente.level).toBe("pro");
    expect(reciente.nextLevel).toBe("senior");
    expect(reciente.cutsToNext).toBe(51);
    expect(reciente.ratio).toBeCloseTo(0);

    // Justo antes de Senior (91): la barra casi llena.
    const casi = levelProgress(90);
    expect(casi.level).toBe("pro");
    expect(casi.cutsToNext).toBe(1);
    expect(casi.ratio).toBeGreaterThan(0.9);
  });

  it("en el nivel más alto no hay siguiente y la barra queda llena", () => {
    const tope = levelProgress(200);

    expect(tope.level).toBe("elite");
    expect(tope.nextLevel).toBeNull();
    expect(tope.cutsToNext).toBe(0);
    expect(tope.ratio).toBe(1);
  });

  it("sin cortes devuelve ceros, sin dividir por cero", () => {
    const vacio = levelProgress(0);

    expect(vacio.level).toBe("junior");
    expect(vacio.cuts).toBe(0);
    expect(vacio.nextLevel).toBe("pro");
    expect(vacio.cutsToNext).toBe(40);
    expect(vacio.ratio).toBe(0);
    expect(Number.isFinite(vacio.ratio)).toBe(true);
  });

  it("tolera valores basura sin romper la barra", () => {
    expect(levelProgress(Number.NaN).cuts).toBe(0);
    expect(levelProgress(-5).cuts).toBe(0);
    expect(levelProgress(12.7).cuts).toBe(12);
  });
});
