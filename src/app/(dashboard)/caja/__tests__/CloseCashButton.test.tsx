import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CloseCashButton } from "../_components/CloseCashButton";
import { useCloseCelebration } from "@/store/closeCelebrationStore";
import { summarizeCash } from "@/lib/cash-summary";
import type { CashSession } from "@/types";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/actions/cash.actions", () => ({
  closeCashSessionAction: vi.fn(),
}));

import { closeCashSessionAction } from "@/actions/cash.actions";

const CERRADA: CashSession = {
  id: "cs1",
  barbershop_id: "b1",
  user_id: "u1",
  start_time: "2026-10-03T11:30:00.000Z",
  end_time: "2026-10-04T00:05:00.000Z",
  initial_balance: 50000,
  final_balance: 530000,
  status: "closed",
};

const SUMMARY = summarizeCash(50000, [
  { type: "income", category: "service", amount: 480000 },
]);

async function cerrar() {
  render(<CloseCashButton sessionId="cs1" />);
  fireEvent.click(screen.getByRole("button", { name: "Cerrar caja" }));
  fireEvent.click(screen.getByRole("button", { name: "Sí, cerrar caja" }));
  await waitFor(() => expect(refreshMock).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
  useCloseCelebration.setState({ celebration: null });
});

describe("CloseCashButton — el ticket del cierre", () => {
  it("con la racha guardada, imprime el ticket con el resumen y el sello", async () => {
    vi.mocked(closeCashSessionAction).mockResolvedValue({
      success: true,
      data: {
        session: CERRADA,
        streak: { previous: 12, current: 13 },
        summary: SUMMARY,
        barberName: "Eduardo",
      },
    });

    await cerrar();

    expect(useCloseCelebration.getState().celebration).toEqual({
      summary: SUMMARY,
      closedAt: CERRADA.end_time,
      barberName: "Eduardo",
      streak: { previous: 12, current: 13 },
    });
  });

  it("la segunda caja del día también imprime: el ticket es el resumen", async () => {
    vi.mocked(closeCashSessionAction).mockResolvedValue({
      success: true,
      data: {
        session: CERRADA,
        streak: { previous: 13, current: 13 },
        summary: SUMMARY,
        barberName: null,
      },
    });

    await cerrar();

    expect(useCloseCelebration.getState().celebration?.streak).toEqual({
      previous: 13,
      current: 13,
    });
  });

  it("sin racha (caja sin cobros o no se pudo guardar), el ticket sale sin sello", async () => {
    vi.mocked(closeCashSessionAction).mockResolvedValue({
      success: true,
      data: {
        session: CERRADA,
        streak: null,
        summary: SUMMARY,
        barberName: "Eduardo",
      },
    });

    await cerrar();

    const celebration = useCloseCelebration.getState().celebration;
    expect(celebration?.summary).toEqual(SUMMARY);
    expect(celebration?.streak).toBeNull();
  });

  it("si el cierre falla, muestra el error y no imprime nada", async () => {
    vi.mocked(closeCashSessionAction).mockResolvedValue({
      success: false,
      error: "Caja no encontrada o ya cerrada.",
    });

    render(<CloseCashButton sessionId="cs1" />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar caja" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, cerrar caja" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Caja no encontrada o ya cerrada.",
    );
    expect(useCloseCelebration.getState().celebration).toBeNull();
  });
});
