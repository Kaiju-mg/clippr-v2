import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VibrationSwitch } from "../VibrationSwitch";

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    value: vi.fn(() => true),
  });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "vibrate");
});

describe("VibrationSwitch", () => {
  it("arranca prendido (el valor por defecto)", () => {
    render(<VibrationSwitch />);
    expect(screen.getByRole("switch", { name: "Vibración" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("apagarlo lo guarda en este dispositivo", () => {
    render(<VibrationSwitch />);
    const sw = screen.getByRole("switch", { name: "Vibración" });

    fireEvent.click(sw);

    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("clippr-vibracion")).toBe("off");
  });

  it("respeta lo que ya estaba guardado", () => {
    localStorage.setItem("clippr-vibracion", "off");
    render(<VibrationSwitch />);
    expect(screen.getByRole("switch", { name: "Vibración" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("en un teléfono sin vibración (iPhone) avisa que ahí no hace nada", () => {
    Reflect.deleteProperty(navigator, "vibrate");
    render(<VibrationSwitch />);
    expect(
      screen.getByText("Este teléfono no vibra desde el navegador."),
    ).toBeInTheDocument();
  });
});
