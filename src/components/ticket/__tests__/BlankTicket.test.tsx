import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlankTicket } from "../BlankTicket";

describe("BlankTicket", () => {
  it("es un ticket en blanco con una sola línea escrita a máquina", () => {
    render(<BlankTicket text="Todavía no hay turnos para este día." />);
    const linea = screen.getByText("Todavía no hay turnos para este día.");
    // La letra de máquina del ticket (Courier Prime, mockeada en Vitest).
    expect(linea).toHaveClass("font-courier-prime", "text-muted");

    const ticket = document.querySelector("[data-blank-ticket]")!;
    expect(ticket).toHaveClass("ticket-edge", "bg-surface-2");
    // Renglones vacíos punteados alrededor de la línea escrita.
    expect(ticket.querySelectorAll(".border-dashed").length).toBeGreaterThan(1);
  });

  it("lo que se le pasa adentro va debajo del ticket (el botón del primero)", () => {
    render(
      <BlankTicket text="Todavía no hay turnos.">
        <button type="button">Agendar el primer turno</button>
      </BlankTicket>,
    );
    const ticket = document.querySelector("[data-blank-ticket]")!;
    const boton = screen.getByRole("button", {
      name: "Agendar el primer turno",
    });
    expect(ticket.contains(boton)).toBe(false);
  });
});
