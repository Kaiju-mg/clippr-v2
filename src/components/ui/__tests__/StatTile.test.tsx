import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatTile } from "../Tile";

const NBSP = String.fromCharCode(0xa0);

describe("StatTile", () => {
  it("una cantidad va en Inter, no en mono", () => {
    render(<StatTile label="Cortes hoy" value="8" />);
    const value = screen.getByText("8");
    expect(value).toHaveClass("font-display", "tabular-nums");
    expect(value).not.toHaveClass("font-mono");
  });

  it("un monto va en font-mono tabular-nums (spec 10)", () => {
    render(<StatTile label="Cobrado hoy" value="Gs. 530.000" mono />);
    const value = screen.getByText("Gs. 530.000");
    expect(value).toHaveClass("font-mono", "tabular-nums");
    expect(value).not.toHaveClass("font-display");
  });

  it("un monto en mono se puede partir entre 'Gs.' y el número", () => {
    // formatGuaranies separa con U+00A0, que no deja partir la línea.
    const { container } = render(
      <StatTile label="Cobrado hoy" value={`Gs.${NBSP}1.250.000`} mono />,
    );
    expect(container.querySelector(".font-mono")?.textContent).toBe(
      "Gs. 1.250.000",
    );
  });

  it("sin mono el valor queda tal cual", () => {
    const { container } = render(
      <StatTile label="Cortes" value={`1${NBSP}234`} />,
    );
    expect(container.querySelector(".font-display")?.textContent).toBe(
      `1${NBSP}234`,
    );
  });
});
