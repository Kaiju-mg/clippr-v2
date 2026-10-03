import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeSwitch } from "../ThemeSwitch";
import { THEME_COOKIE } from "@/lib/theme";

function cookieTheme(): string | undefined {
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${THEME_COOKIE}=`))
    ?.split("=")[1];
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  // jsdom comparte `document` entre tests: la cookie hay que vencerla a mano.
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
});

describe("ThemeSwitch", () => {
  it("se dibuja apagado cuando el tema que baja del servidor es claro", () => {
    render(<ThemeSwitch initialTheme="light" />);

    expect(screen.getByRole("switch", { name: "Modo oscuro" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("se dibuja encendido cuando el tema que baja del servidor es oscuro", () => {
    render(<ThemeSwitch initialTheme="dark" />);

    expect(screen.getByRole("switch", { name: "Modo oscuro" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("pinta el DOM y guarda la cookie al encender el modo oscuro", () => {
    render(<ThemeSwitch initialTheme="light" />);

    fireEvent.click(screen.getByRole("switch", { name: "Modo oscuro" }));

    // El `data-theme` se escribe en el acto: el color no espera al servidor.
    expect(document.documentElement.dataset.theme).toBe("dark");
    // Y la cookie queda para que el próximo render ya llegue oscuro.
    expect(cookieTheme()).toBe("dark");
  });

  it("vuelve a claro al apagarlo", () => {
    render(<ThemeSwitch initialTheme="dark" />);

    fireEvent.click(screen.getByRole("switch", { name: "Modo oscuro" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(cookieTheme()).toBe("light");
  });
});
