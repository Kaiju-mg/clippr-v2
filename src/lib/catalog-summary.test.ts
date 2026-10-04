import { describe, expect, it } from "vitest";
import { catalogSummary } from "./catalog-summary";

describe("catalogSummary", () => {
  it("activos y pausados, con singular y plural", () => {
    expect(catalogSummary({ active: 3, paused: 1 })).toBe(
      "3 activos · 1 pausado",
    );
    expect(catalogSummary({ active: 1, paused: 2 })).toBe(
      "1 activo · 2 pausados",
    );
  });

  it("sin pausados no los nombra", () => {
    expect(catalogSummary({ active: 4, paused: 0 })).toBe("4 activos");
  });

  it("los productos suman los agotados si hay", () => {
    expect(catalogSummary({ active: 2, paused: 0, soldOut: 1 })).toBe(
      "2 activos · 1 agotado",
    );
  });

  it("todo pausado igual dice cuántos activos hay", () => {
    expect(catalogSummary({ active: 0, paused: 3 })).toBe(
      "0 activos · 3 pausados",
    );
  });
});
