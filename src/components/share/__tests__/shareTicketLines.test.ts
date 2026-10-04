import { describe, expect, it } from "vitest";
import { summarizeCash } from "@/lib/cash-summary";
import { formatGuaranies } from "@/lib/utils";
import type { ShareDay } from "@/lib/share-day";
import { shareTicketLines } from "../shareTicketLines";
import type { TicketLine } from "@/components/ticket/TicketReceipt";

const SUMMARY = summarizeCash(50000, [
  ...Array.from({ length: 8 }, () => ({
    type: "income",
    category: "service",
    amount: 50000,
  })),
  { type: "income", category: "product", amount: 60000 },
  { type: "expense", category: "manual", amount: 40000 },
]);

const SHARE: ShareDay = {
  barbershopName: "Barbería El Poste",
  phone: "0981 123 456",
  cutsByService: [
    { name: "Corte clásico", count: 5 },
    { name: "Corte + barba", count: 2 },
    { name: "Perfilado", count: 1 },
  ],
};

const OPTS = {
  // 00:05 UTC del 4 son las 21:05 del sábado 3 en Paraguay.
  closedAt: "2026-10-04T00:05:00.000Z",
  barberName: "Eduardo Villalba",
};

function text(lines: TicketLine[]): string {
  return lines
    .map((line) =>
      line.kind === "rule"
        ? "---"
        : line.kind === "center"
          ? line.text
          : `${line.label} ${line.value}`,
    )
    .join("\n");
}

describe("shareTicketLines — la versión cliente del ticket", () => {
  it("encabezado: la barbería en mayúsculas, el día y el barbero de pila", () => {
    const lines = shareTicketLines(SUMMARY, SHARE, {
      ...OPTS,
      showAmounts: false,
    });
    expect(lines.slice(0, 3)).toEqual([
      { kind: "center", text: "BARBERÍA EL POSTE", strong: true },
      { kind: "center", text: "Sábado 03/10/2026" },
      { kind: "center", text: "Barbero: Eduardo" },
    ]);
  });

  it("cortes por servicio y el total de cortes, tal como vienen del servidor", () => {
    const lines = shareTicketLines(SUMMARY, SHARE, {
      ...OPTS,
      showAmounts: false,
    });
    const rows = lines
      .filter((line) => line.kind === "row")
      .map((line) => [line.label, line.value]);
    expect(rows).toEqual([
      ["Corte clásico", "x5"],
      ["Corte + barba", "x2"],
      ["Perfilado", "x1"],
      ["CORTES", "8"],
    ]);
  });

  it("con el switch apagado no publica ningún monto", () => {
    const out = text(
      shareTicketLines(SUMMARY, SHARE, { ...OPTS, showAmounts: false }),
    );
    expect(out).not.toMatch(/TOTAL/);
    expect(out).not.toMatch(/Gs\./);
    // Ningún número con separador de miles (los montos), ni el saldo final.
    expect(out).not.toMatch(/\d{1,3}\.\d{3}/);
    expect(out).not.toContain(String(SUMMARY.finalBalance));
  });

  it("con el switch prendido suma el TOTAL, que es el mismo del cierre", () => {
    const lines = shareTicketLines(SUMMARY, SHARE, {
      ...OPTS,
      showAmounts: true,
    });
    const total = lines.at(-1);
    expect(total).toEqual({
      kind: "row",
      label: "TOTAL",
      value: formatGuaranies(470000),
      strong: true,
    });
    // 50.000 inicial + 400.000 cortes + 60.000 venta − 40.000 egreso.
    expect(SUMMARY.finalBalance).toBe(470000);
  });

  it("sin barbero conocido, no dibuja ese renglón", () => {
    const lines = shareTicketLines(SUMMARY, SHARE, {
      ...OPTS,
      barberName: null,
      showAmounts: false,
    });
    expect(text(lines)).not.toMatch(/Barbero/);
  });

  it("un día sin cortes lo dice, en vez de dejar el ticket vacío", () => {
    const lines = shareTicketLines(
      summarizeCash(0, []),
      { ...SHARE, cutsByService: [] },
      { ...OPTS, showAmounts: false },
    );
    expect(text(lines)).toContain("Hoy no hubo cortes");
    expect(text(lines)).toContain("CORTES 0");
  });
});
