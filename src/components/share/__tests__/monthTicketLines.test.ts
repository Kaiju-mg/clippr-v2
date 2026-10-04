import { describe, expect, it } from "vitest";
import type { MonthSummary } from "@/lib/month-summary";
import { formatGuaranies } from "@/lib/utils";
import { monthTicketLines } from "../monthTicketLines";

const MES: MonthSummary = {
  monthStartISO: "2026-09-01",
  cuts: 87,
  topService: { name: "Corte clásico", count: 40 },
  bestDay: { dateISO: "2026-09-12", cuts: 9 },
  longestStreak: 12,
  income: 4350000,
};

const OPTS = {
  barbershopName: "Barbería El Poste",
  barberName: "Caillu Pérez",
};

function texto(showAmounts: boolean, mes: MonthSummary = MES) {
  return monthTicketLines(mes, { ...OPTS, showAmounts })
    .map((l) =>
      l.kind === "rule"
        ? "---"
        : l.kind === "center"
          ? l.text
          : `${l.label} | ${l.value}`,
    )
    .join("\n");
}

describe("monthTicketLines — el ticket del mes", () => {
  it("encabezado, cortes, más pedido, mejor día y racha más larga", () => {
    expect(texto(false)).toBe(
      [
        "BARBERÍA EL POSTE",
        "Septiembre 2026",
        "Barbero: Caillu",
        "---",
        "Cortes | 87",
        "Más pedido: Corte clásico | x40",
        "Mejor día: Sáb 12/09 | x9",
        "Racha más larga | 12 días",
      ].join("\n"),
    );
  });

  it("sin 'Mostrar montos' no lleva ningún monto", () => {
    expect(texto(false)).not.toMatch(/Gs\.|COBRADO|\d{1,3}\.\d{3}/);
  });

  it("con 'Mostrar montos' suma lo cobrado en el mes", () => {
    const lines = monthTicketLines(MES, { ...OPTS, showAmounts: true });
    expect(lines.at(-1)).toEqual({
      kind: "row",
      label: "COBRADO",
      value: formatGuaranies(4350000),
      strong: true,
    });
  });

  it("un mes con días trabajados pero sin cortes: sin 'más pedido' ni 'mejor día'", () => {
    const out = texto(false, {
      ...MES,
      cuts: 0,
      topService: null,
      bestDay: null,
      longestStreak: 1,
    });
    expect(out).not.toMatch(/Más pedido|Mejor día/);
    expect(out).toContain("Racha más larga | 1 día");
  });
});
