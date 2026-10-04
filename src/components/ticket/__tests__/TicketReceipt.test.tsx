import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketReceipt, type TicketLine } from "../TicketReceipt";

const LINES: TicketLine[] = [
  { kind: "center", text: "CLIPPR · CIERRE", strong: true },
  { kind: "rule" },
  { kind: "row", label: "Cortes (8)", value: "+ 400.000" },
  { kind: "rule" },
  { kind: "row", label: "TOTAL", value: "Gs. 530.000", strong: true },
];

describe("TicketReceipt", () => {
  it("dibuja los renglones tal como vienen", () => {
    render(<TicketReceipt lines={LINES} label="Cierre de caja" />);
    const ticket = screen.getByRole("region", { name: "Cierre de caja" });

    expect(ticket).toHaveTextContent("CLIPPR · CIERRE");
    expect(screen.getByText("Cortes (8)").nextSibling).toHaveTextContent(
      "+ 400.000",
    );
    expect(screen.getByText("TOTAL").parentElement).toHaveClass("font-bold");
  });

  it("los separadores son punteados en --paper-rule", () => {
    const { container } = render(<TicketReceipt lines={LINES} />);
    const rules = container.querySelectorAll("hr");
    expect(rules).toHaveLength(2);
    rules.forEach((rule) =>
      expect(rule).toHaveClass("border-dashed", "border-paper-rule"),
    );
  });

  it("es papel: no cambia con el tema y lleva el borde en zigzag", () => {
    render(<TicketReceipt lines={LINES} label="Ticket" />);
    const ticket = screen.getByRole("region", { name: "Ticket" });
    expect(ticket).toHaveClass(
      "bg-paper",
      "text-paper-ink",
      "ticket-edge",
      "[--stamp:var(--paper-stamp)]",
    );
    expect(ticket.className).not.toMatch(/bg-background|bg-surface/);
  });

  it("usa Courier Prime, no la fuente de la app", () => {
    render(<TicketReceipt lines={LINES} label="Ticket" />);
    expect(screen.getByRole("region", { name: "Ticket" })).toHaveClass(
      "font-courier-prime",
    );
  });

  it("muestra el pie que se le pase", () => {
    render(<TicketReceipt lines={LINES} footer={<p>Mañana va el 14.</p>} />);
    expect(screen.getByText("Mañana va el 14.")).toBeInTheDocument();
  });
});
