import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MEJOR_LABELS,
  OwnerDashboard,
  type RangeKey,
} from "../_components/OwnerDashboard";
import type { OwnerStats } from "@/actions/stats.actions";

const STATS: OwnerStats = {
  startDateISO: "2026-10-01",
  endDateISO: "2026-10-03",
  days: 3,
  totalIncome: 4250000,
  totalServiceIncome: 3900000,
  totalCuts: 78,
  dailyAverageIncome: 1416667,
  averageTicket: 50000,
  leaderboard: [
    {
      userId: "1",
      name: "Eduardo",
      cuts: 40,
      income: 2100000,
      serviceIncome: 2000000,
    },
    {
      userId: "2",
      name: "Matías",
      cuts: 28,
      income: 1450000,
      serviceIncome: 1400000,
    },
    { userId: "3", name: "Diego", cuts: 0, income: 0, serviceIncome: 0 },
  ],
};

describe("OwnerDashboard — ranking del equipo", () => {
  it.each<RangeKey>(["hoy", "semana", "mes"])(
    "el primero lleva el sello del rango (%s)",
    (range) => {
      render(<OwnerDashboard stats={STATS} range={range} />);
      const sello = screen.getByText(MEJOR_LABELS[range]);
      expect(sello).toHaveAttribute("data-stamp");
      expect(sello.parentElement).toHaveTextContent("Eduardo");
    },
  );

  it("hay un solo sello: sólo el primer puesto", () => {
    render(<OwnerDashboard stats={STATS} range="mes" />);
    expect(document.querySelectorAll("[data-stamp]")).toHaveLength(1);
  });

  it("sin actividad en el rango no hay mejor del mes", () => {
    render(
      <OwnerDashboard
        stats={{
          ...STATS,
          leaderboard: STATS.leaderboard.map((member) => ({
            ...member,
            cuts: 0,
            income: 0,
          })),
        }}
        range="mes"
      />,
    );
    expect(document.querySelector("[data-stamp]")).toBeNull();
    expect(
      screen.getByText("No hay actividad en este periodo."),
    ).toBeInTheDocument();
  });

  it("las barras del ranking son perforadas", () => {
    render(<OwnerDashboard stats={STATS} range="mes" />);
    const barras = screen.getAllByRole("progressbar");
    expect(barras).toHaveLength(2);
    barras.forEach((barra) => expect(barra).toHaveClass("perforated"));
  });
});
