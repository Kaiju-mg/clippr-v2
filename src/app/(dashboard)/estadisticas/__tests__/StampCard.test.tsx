import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { shiftDateISO } from "@/lib/dates";
import { stampCardDays } from "@/lib/stamp-card";
import { StampCard } from "../_components/StampCard";

const seguidos = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => shiftDateISO(from, i));

function card(worked: string[], today = "2026-10-20") {
  return {
    monthStartISO: "2026-10-01",
    days: stampCardDays("2026-10-01", today, worked),
  };
}

describe("StampCard — tarjeta de sellos", () => {
  it("un casillero por día; los trabajados llevan sello", () => {
    render(<StampCard card={card(["2026-10-02", "2026-10-03"])} />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(31);
    const sellados = document.querySelectorAll("[data-worked] [data-stamp]");
    expect([...sellados].map((s) => s.textContent)).toEqual(["2", "3"]);
    expect(screen.getByText("2 sellos")).toBeInTheDocument();
  });

  it("el 1° de octubre de 2026 (jueves) arranca en la cuarta columna", () => {
    render(<StampCard card={card([])} />);
    const grid = screen.getByRole("grid", {
      name: "Tarjeta de sellos de octubre",
    });
    // 7 iniciales de la semana + 3 huecos antes del jueves 1.
    expect(grid.children[10]).toHaveAttribute("role", "gridcell");
    expect(grid.children[9]).not.toHaveAttribute("role");
  });

  it("el día 7 de la racha lleva el poste de oro y lo dice", () => {
    render(<StampCard card={card(seguidos("2026-10-01", 8))} />);
    const dia7 = screen.getByRole("gridcell", { name: /^7 de octubre/ });
    expect(dia7).toHaveAttribute("data-milestone", "oro");
    expect(dia7.querySelector('[data-tier="oro"]')).not.toBeNull();
    expect(dia7).toHaveAccessibleName(
      "7 de octubre, sellado, 7 días de racha, poste de oro",
    );
  });

  it("los sellos están quietos: no es algo que acaba de pasar", () => {
    render(<StampCard card={card(["2026-10-02"])} />);
    expect(document.querySelector("[data-stamp]")).not.toHaveClass(
      "animate-stamp-slam",
    );
  });

  it("explica qué es un sello y qué marca el poste", () => {
    render(<StampCard card={card([])} />);
    expect(
      screen.getByText(/el día 7 \(oro\) y el 30 \(encendido\) de la racha/),
    ).toBeInTheDocument();
  });
});
