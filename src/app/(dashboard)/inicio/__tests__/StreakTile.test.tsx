import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakTile, StreakWarning } from "../_components/StreakTile";

function poste(container: HTMLElement) {
  return container.querySelector("[data-tier]");
}

describe("StreakTile — cubo de racha de /inicio", () => {
  it("racha viva: número, etiqueta y el poste girando", () => {
    const { container } = render(
      <StreakTile streak={{ count: 12, status: "activa" }} />,
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Días de racha")).toBeInTheDocument();
    expect(poste(container)).toHaveAttribute("data-status", "activa");
    expect(poste(container)).toHaveAttribute("data-tier", "oro");
  });

  it("un solo día va en singular", () => {
    render(<StreakTile streak={{ count: 1, status: "activa" }} />);
    expect(screen.getByText("Día de racha")).toBeInTheDocument();
  });

  it("día de gracia: el poste se frena y la etiqueta pide cerrar hoy", () => {
    const { container } = render(
      <StreakTile streak={{ count: 12, status: "en_peligro" }} />,
    );

    expect(screen.getByText("Cerrá hoy")).toBeInTheDocument();
    expect(poste(container)).toHaveAttribute("data-status", "en_peligro");
    expect(screen.getByRole("link")).toHaveClass("border-warning");
  });

  it("racha apagada: poste gris y 'Empezá hoy'", () => {
    const { container } = render(
      <StreakTile streak={{ count: 0, status: "apagada" }} />,
    );

    expect(screen.getByText("Empezá hoy")).toBeInTheDocument();
    expect(poste(container)).toHaveAttribute("data-status", "apagada");
  });

  it("sin datos no inventa un número", () => {
    render(<StreakTile />);
    expect(screen.getByText("Días de racha")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("lleva a /estadisticas", () => {
    render(<StreakTile streak={{ count: 3, status: "activa" }} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/estadisticas");
  });
});

describe("StreakWarning", () => {
  it("dice qué hacer y cuántos días se pierden", () => {
    render(<StreakWarning count={12} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ayer no cerraste la caja. Cerrala hoy, con al menos un cobro, para no perder tus 12 días de racha.",
    );
  });
});
