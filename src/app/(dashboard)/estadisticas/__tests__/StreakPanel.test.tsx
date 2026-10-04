import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakPanel } from "../_components/StreakPanel";

describe("StreakPanel — la racha en /estadisticas", () => {
  it("nombra el poste según el nivel y dice cuánto falta para el siguiente", () => {
    render(<StreakPanel count={4} status="activa" />);
    expect(screen.getByText("Poste de acero")).toBeInTheDocument();
    expect(screen.getByText("A 3 días del poste de oro.")).toBeInTheDocument();
  });

  it("'Poste encendido', no 'de encendido'", () => {
    render(<StreakPanel count={12} status="activa" />);
    expect(
      screen.getByText("A 18 días del poste encendido."),
    ).toBeInTheDocument();
  });

  it("en el último nivel no promete nada más", () => {
    render(<StreakPanel count={45} status="activa" />);
    expect(screen.getByText("Poste encendido")).toBeInTheDocument();
    expect(screen.getByText("Tu poste ya está encendido.")).toBeInTheDocument();
  });

  it("en el día de gracia avisa que hay que cerrar hoy", () => {
    render(<StreakPanel count={12} status="en_peligro" />);
    expect(
      screen.getByText(
        "Ayer no cerraste la caja: cerrala hoy para no perderla.",
      ),
    ).toBeInTheDocument();
  });

  it("marca el nivel actual en la escalera", () => {
    render(<StreakPanel count={12} status="activa" />);
    expect(screen.getByText("Oro")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Acero")).not.toHaveAttribute("aria-current");
  });
});

describe("StreakPanel — tema Recibo", () => {
  it("el número de días va en tinta de sello", () => {
    render(<StreakPanel count={13} status="activa" />);
    expect(screen.getByText("13")).toHaveClass("text-stamp");
  });
});
