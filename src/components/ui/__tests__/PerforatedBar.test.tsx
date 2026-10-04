import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerforatedBar } from "../PerforatedBar";

function fillOf(bar: HTMLElement): HTMLElement {
  return bar.firstElementChild as HTMLElement;
}

describe("PerforatedBar", () => {
  it("expone el progreso como progressbar accesible", () => {
    render(<PerforatedBar value={0.42} label="Progreso hacia Pro" />);

    const bar = screen.getByRole("progressbar", { name: "Progreso hacia Pro" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(fillOf(bar).style.width).toBe("42%");
  });

  it("recorta valores fuera de 0..1", () => {
    const { rerender } = render(<PerforatedBar value={1.7} label="barra" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(fillOf(bar).style.width).toBe("100%");

    rerender(<PerforatedBar value={-0.3} label="barra" />);
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(fillOf(bar).style.width).toBe("0%");
  });

  it("riel y relleno son perforados y sin redondeo", () => {
    render(<PerforatedBar value={0.5} label="barra" />);
    const bar = screen.getByRole("progressbar");

    for (const element of [bar, fillOf(bar)]) {
      expect(element).toHaveClass("perforated");
      expect(element.className).not.toMatch(/rounded/);
    }
  });

  it("usa la tinta sobre el fondo y el papel sobre el cubo relleno", () => {
    const { rerender } = render(<PerforatedBar value={0.5} label="barra" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveClass("text-line");
    expect(fillOf(bar)).toHaveClass("text-accent");

    rerender(<PerforatedBar value={0.5} label="barra" tone="on-accent" />);
    expect(bar).toHaveClass("text-accent-contrast/30");
    expect(fillOf(bar)).toHaveClass("text-accent-contrast");
  });
});
