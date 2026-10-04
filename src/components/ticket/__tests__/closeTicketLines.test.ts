import { describe, expect, it } from "vitest";
import { summarizeCash } from "@/lib/cash-summary";
import { formatGuaranies } from "@/lib/utils";
import { closeTicketLines } from "../closeTicketLines";
import type { TicketLine } from "../TicketReceipt";

const SUMMARY = summarizeCash(50000, [
  ...Array.from({ length: 8 }, () => ({
    type: "income",
    category: "service",
    amount: 50000,
  })),
  { type: "income", category: "product", amount: 60000 },
  { type: "income", category: "product", amount: 60000 },
  { type: "expense", category: "manual", amount: 40000 },
]);

const META = {
  // 00:05 UTC del 4 son las 21:05 del sábado 3 en Paraguay.
  closedAt: "2026-10-04T00:05:00.000Z",
  barberName: "Eduardo Villalba",
};

function rows(lines: TicketLine[]) {
  return lines
    .filter((line) => line.kind === "row")
    .map((line) => [line.label, line.value]);
}

describe("closeTicketLines", () => {
  it("encabezado: CLIPPR · CIERRE, fecha y hora, y el barbero de pila", () => {
    const lines = closeTicketLines(SUMMARY, META);
    expect(lines.slice(0, 3)).toEqual([
      { kind: "center", text: "CLIPPR · CIERRE", strong: true },
      { kind: "center", text: "Sáb 03/10/2026 · 21:05" },
      { kind: "center", text: "Barbero: Eduardo" },
    ]);
  });

  it("los renglones salen del summary, sin cálculo propio", () => {
    expect(rows(closeTicketLines(SUMMARY, META))).toEqual([
      ["Saldo inicial", "50.000"],
      ["Cortes (8)", "+ 400.000"],
      ["Ventas (2)", "+ 120.000"],
      ["Egresos", "− 40.000"],
      ["TOTAL", formatGuaranies(530000)],
    ]);
  });

  it("el TOTAL es el saldo final del servidor", () => {
    const total = closeTicketLines(SUMMARY, META).at(-1);
    expect(total).toEqual({
      kind: "row",
      label: "TOTAL",
      value: formatGuaranies(SUMMARY.finalBalance),
      strong: true,
    });
  });

  it("los ingresos manuales sólo aparecen si hubo", () => {
    const conPropina = summarizeCash(0, [
      { type: "income", category: "manual", amount: 10000 },
    ]);
    expect(rows(closeTicketLines(conPropina, META))).toContainEqual([
      "Otros ingresos",
      "+ 10.000",
    ]);
    expect(
      rows(closeTicketLines(SUMMARY, META)).map(([label]) => label),
    ).not.toContain("Otros ingresos");
  });

  it("sin nombre de barbero, el ticket sale sin ese renglón", () => {
    const lines = closeTicketLines(SUMMARY, { ...META, barberName: null });
    expect(
      lines.some(
        (line) => line.kind === "center" && line.text.startsWith("Barbero"),
      ),
    ).toBe(false);
  });
});
