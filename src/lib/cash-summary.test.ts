import { describe, expect, it } from "vitest";
import { summarizeCash } from "./cash-summary";

describe("summarizeCash", () => {
  it("separa cortes, ventas, ingresos manuales y egresos", () => {
    const summary = summarizeCash(50000, [
      { type: "income", category: "service", amount: 50000 },
      { type: "income", category: "service", amount: 70000 },
      { type: "income", category: "product", amount: 60000 },
      { type: "income", category: "manual", amount: 10000 },
      { type: "expense", category: "manual", amount: 40000 },
    ]);

    expect(summary).toEqual({
      initialBalance: 50000,
      cuts: { count: 2, total: 120000 },
      sales: { count: 1, total: 60000 },
      manualIncome: 10000,
      expenses: 40000,
      income: 190000,
      finalBalance: 200000,
    });
  });

  it("el saldo final es inicial + ingresos − egresos", () => {
    const summary = summarizeCash(30000, [
      { type: "income", category: "service", amount: 45000 },
      { type: "expense", category: "manual", amount: 5000 },
    ]);
    expect(summary.finalBalance).toBe(30000 + 45000 - 5000);
  });

  it("sin movimientos, el saldo final es el inicial", () => {
    const summary = summarizeCash(80000, []);
    expect(summary.finalBalance).toBe(80000);
    expect(summary.cuts).toEqual({ count: 0, total: 0 });
    expect(summary.sales).toEqual({ count: 0, total: 0 });
  });

  it("acepta montos como texto (numeric de Postgres)", () => {
    const summary = summarizeCash(0, [
      { type: "income", category: "service", amount: "45000" },
    ]);
    expect(summary.cuts.total).toBe(45000);
  });

  it("un ingreso sin categoría cuenta como manual, no como corte", () => {
    // Así no infla el contador de cortes del ticket por un dato raro.
    const summary = summarizeCash(0, [{ type: "income", amount: 1000 }]);
    expect(summary.cuts.count).toBe(0);
    expect(summary.manualIncome).toBe(1000);
  });

  it("un egreso de cualquier categoría resta igual", () => {
    const summary = summarizeCash(10000, [
      { type: "expense", category: "product", amount: 2000 },
    ]);
    expect(summary.expenses).toBe(2000);
    expect(summary.finalBalance).toBe(8000);
  });
});
