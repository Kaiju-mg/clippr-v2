import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { summarizeCash } from "@/lib/cash-summary";
import { formatGuaranies } from "@/lib/utils";
import { TeamClosures } from "../_components/TeamClosures";

const CIERRE = {
  sessionId: "cs1",
  userId: "u1",
  barberName: "Caillu Pérez",
  closedAt: "2026-10-04T20:00:00.000Z",
  summary: summarizeCash(50000, [
    { type: "income", category: "service", amount: 45000 },
  ]),
};

describe("TeamClosures", () => {
  it("dibuja el ticket de cada cierre con el TOTAL del servidor", () => {
    render(
      <TeamClosures
        closures={[CIERRE, { ...CIERRE, sessionId: "cs2", barberName: "Edu" }]}
      />,
    );
    const ticket = screen.getByRole("region", {
      name: "Cierre de Caillu Pérez",
    });
    expect(ticket).toHaveTextContent("Barbero: Caillu");
    expect(within(ticket).getByText("TOTAL").nextSibling?.textContent).toBe(
      formatGuaranies(95000),
    );
    expect(
      screen.getByRole("region", { name: "Cierre de Edu" }),
    ).toBeInTheDocument();
  });

  it("si nadie cerró, un ticket en blanco", () => {
    render(<TeamClosures closures={[]} />);
    expect(
      screen.getByText("Nadie cerró la caja hoy todavía."),
    ).toBeInTheDocument();
  });

  it("si la consulta falló, lo dice", () => {
    render(<TeamClosures closures={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar los cierres de hoy.",
    );
  });
});
