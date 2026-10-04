import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("html-to-image", () => ({ toBlob: vi.fn() }));

import { MonthTicketCard } from "../_components/MonthTicketCard";

const TICKET = {
  month: {
    monthStartISO: "2026-09-01",
    cuts: 87,
    topService: { name: "Corte clásico", count: 40 },
    bestDay: { dateISO: "2026-09-12", cuts: 9 },
    longestStreak: 12,
    income: 4350000,
  },
  barberName: "Caillu Pérez",
  barbershopName: "El Poste",
  phone: "0981 123 456",
};

describe("MonthTicketCard", () => {
  it("muestra el ticket del mes sin montos", () => {
    render(<MonthTicketCard ticket={TICKET} />);
    expect(
      screen.getByRole("heading", { name: "Tu septiembre" }),
    ).toBeInTheDocument();
    const ticket = screen.getByRole("region", { name: "Ticket del mes" });
    expect(ticket).toHaveTextContent("Septiembre 2026");
    expect(ticket).toHaveTextContent("Cortes87");
    expect(ticket.textContent).not.toMatch(/Gs\.|COBRADO/);
  });

  it("'Compartir el mes' abre la pantalla de compartir con montos apagados", () => {
    render(<MonthTicketCard ticket={TICKET} />);
    fireEvent.click(screen.getByRole("button", { name: /compartir el mes/i }));

    const pantalla = screen.getByRole("dialog", { name: "Compartir el mes" });
    expect(
      within(pantalla).getByRole("switch", { name: "Mostrar montos" }),
    ).toHaveAttribute("aria-checked", "false");
    const imagen = within(pantalla).getByRole("region", {
      name: "Ticket del mes",
    });
    expect(imagen).toHaveTextContent("Turnos: 0981 123 456");

    fireEvent.click(
      within(pantalla).getByRole("switch", { name: "Mostrar montos" }),
    );
    expect(imagen).toHaveTextContent("COBRADO");
  });

  it("Escape vuelve de la pantalla de compartir", () => {
    render(<MonthTicketCard ticket={TICKET} />);
    fireEvent.click(screen.getByRole("button", { name: /compartir el mes/i }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
