import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { setOnline } from "@/test/network";
import { TimerList } from "../TimerList";

describe("TimerList: aviso de caja cerrada", () => {
  it("sin caja abierta muestra un cubo que lleva a /caja, no un error", () => {
    render(<TimerList cashSessionId={null} services={[]} />);

    const link = screen.getByRole("link", { name: /tu caja está cerrada/i });
    expect(link).toHaveAttribute("href", "/caja");
    // Ya no es un error en rojo: ni `role="alert"` ni `text-danger`.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(link.querySelector(".text-danger")).toBeNull();
  });

  it("con la caja abierta no muestra el aviso", () => {
    render(<TimerList cashSessionId="cs1" services={[]} />);

    expect(
      screen.queryByRole("link", { name: /tu caja está cerrada/i }),
    ).not.toBeInTheDocument();
  });

  it("se puede iniciar un corte con la caja cerrada (regla 4)", () => {
    render(<TimerList cashSessionId={null} services={[]} />);

    expect(
      screen.getByRole("button", { name: /iniciar corte/i }),
    ).toBeEnabled();
  });
});

describe("TimerList — sin señal (spec 10, fase 3)", () => {
  it("los temporizadores siguen andando: 'Iniciar corte' no depende de la red (regla 4)", () => {
    render(<TimerList cashSessionId="cs1" services={[]} />);
    setOnline(false);

    expect(
      screen.getByRole("button", { name: /iniciar corte/i }),
    ).toBeEnabled();
  });
});
