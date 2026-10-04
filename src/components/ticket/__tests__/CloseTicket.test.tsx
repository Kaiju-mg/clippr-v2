import { describe, expect, it, beforeEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { CloseTicket, SELLO_DELAY_MS } from "../CloseTicket";
import {
  useCloseCelebration,
  type CloseCelebration,
} from "@/store/closeCelebrationStore";
import { summarizeCash } from "@/lib/cash-summary";
import { formatGuaranies } from "@/lib/utils";

const SUMMARY = summarizeCash(50000, [
  { type: "income", category: "service", amount: 400000 },
  { type: "income", category: "product", amount: 120000 },
  { type: "expense", category: "manual", amount: 40000 },
]);

const CIERRE: CloseCelebration = {
  summary: SUMMARY,
  closedAt: "2026-10-04T00:05:00.000Z",
  barberName: "Eduardo Villalba",
  streak: { previous: 12, current: 13 },
};

function abrir(celebration: CloseCelebration = CIERRE) {
  render(<CloseTicket />);
  act(() => useCloseCelebration.getState().show(celebration));
  return screen.getByRole("dialog", { name: "Cierre de caja" });
}

beforeEach(() => {
  useCloseCelebration.setState({ celebration: null });
});

describe("CloseTicket", () => {
  it("no muestra nada si no se cerró una caja", () => {
    render(<CloseTicket />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("imprime el ticket con el resumen del servidor y el TOTAL del saldo final", () => {
    abrir();
    const ticket = screen.getByRole("region", { name: "Ticket del cierre" });

    expect(ticket).toHaveTextContent("CLIPPR · CIERRE");
    expect(ticket).toHaveTextContent("Sáb 03/10/2026 · 21:05");
    expect(ticket).toHaveTextContent("Barbero: Eduardo");
    expect(within(ticket).getByText("TOTAL").nextSibling?.textContent).toBe(
      formatGuaranies(SUMMARY.finalBalance),
    );
  });

  it("con racha, cae el sello con los días y dice cuál va mañana", () => {
    abrir();
    const ticket = screen.getByRole("region", { name: "Ticket del cierre" });
    const stamp = ticket.querySelector("[data-stamp]") as HTMLElement;

    expect(stamp).toHaveTextContent("13 DÍAS DE RACHA");
    // Cae después de imprimir, y respeta "reducir movimiento".
    expect(stamp).toHaveClass(
      "animate-stamp-slam",
      "motion-reduce:animate-none",
    );
    expect(stamp.style.animationDelay).toBe(`${SELLO_DELAY_MS}ms`);
    expect(ticket).toHaveTextContent("Mañana va el 14.");
  });

  it("un día de racha va en singular", () => {
    abrir({ ...CIERRE, streak: { previous: 0, current: 1 } });
    expect(
      screen.getByRole("region", { name: "Ticket del cierre" }),
    ).toHaveTextContent("1 DÍA DE RACHA");
  });

  it("si la racha no se guardó, el ticket sale igual pero sin sello", () => {
    abrir({ ...CIERRE, streak: null });
    const ticket = screen.getByRole("region", { name: "Ticket del cierre" });

    expect(ticket).toHaveTextContent("TOTAL");
    expect(ticket.querySelector("[data-stamp]")).toBeNull();
    expect(ticket).not.toHaveTextContent("Mañana va el");
  });

  it("todas las animaciones se apagan con 'reducir movimiento'", () => {
    const dialog = abrir();
    const animados = [
      dialog,
      ...dialog.querySelectorAll<HTMLElement>("[class*='animate-']"),
    ];
    expect(animados.length).toBeGreaterThan(3);
    animados.forEach((element) =>
      expect(element).toHaveClass("motion-reduce:animate-none"),
    );
  });

  it("se cierra con 'Listo'", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("se cierra con Escape", () => {
    abrir();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tocar el ticket no lo cierra; tocar el fondo sí", () => {
    const dialog = abrir();
    fireEvent.click(screen.getByRole("region", { name: "Ticket del cierre" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("todavía no ofrece 'Compartir' (llega con la fase 3)", () => {
    abrir();
    expect(
      screen.queryByRole("button", { name: /compartir/i }),
    ).not.toBeInTheDocument();
  });
});
