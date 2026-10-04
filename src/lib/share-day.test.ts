import { describe, expect, it } from "vitest";
import { countCutsByService } from "./share-day";

const corte = (name: string | null) => ({ services: { name } });

describe("countCutsByService", () => {
  it("agrupa por servicio, del más pedido al menos pedido", () => {
    expect(
      countCutsByService([
        corte("Perfilado"),
        corte("Corte clásico"),
        corte("Corte + barba"),
        corte("Corte clásico"),
        corte("Corte + barba"),
        corte("Corte clásico"),
      ]),
    ).toEqual([
      { name: "Corte clásico", count: 3 },
      { name: "Corte + barba", count: 2 },
      { name: "Perfilado", count: 1 },
    ]);
  });

  it("a igual cantidad ordena alfabético, para que la imagen salga siempre igual", () => {
    expect(
      countCutsByService([corte("Perfilado"), corte("Barba"), corte("Corte")]),
    ).toEqual([
      { name: "Barba", count: 1 },
      { name: "Corte", count: 1 },
      { name: "Perfilado", count: 1 },
    ]);
  });

  it("un servicio sin nombre (o que ya no se puede leer) cuenta como 'Corte'", () => {
    expect(
      countCutsByService([corte(null), { services: null }, corte("  ")]),
    ).toEqual([{ name: "Corte", count: 3 }]);
  });

  it("sin cortes, lista vacía", () => {
    expect(countCutsByService([])).toEqual([]);
  });
});
