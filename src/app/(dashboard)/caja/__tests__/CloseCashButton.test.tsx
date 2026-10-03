import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CloseCashButton } from "../_components/CloseCashButton";
import { useStreakCelebration } from "@/store/streakCelebrationStore";
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

async function cerrar() {
  render(<CloseCashButton sessionId="cs1" />);
  fireEvent.click(screen.getByRole("button", { name: "Cerrar caja" }));
  fireEvent.click(screen.getByRole("button", { name: "Sí, cerrar caja" }));
  await waitFor(() => expect(refreshMock).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
  useStreakCelebration.setState({ celebration: null });
});

describe("CloseCashButton — la hoja del poste", () => {
  it("si la racha subió, abre la hoja con el antes, el después y el saldo", async () => {
    vi.mocked(closeCashSessionAction).mockResolvedValue({
      success: true,
      data: { session: CERRADA, streak: { previous: 12, current: 13 } },
    });

    await cerrar();

    expect(useStreakCelebration.getState().celebration).toEqual({
      previous: 12,
      current: 13,
      finalBalance: 530000,
    });
  });

  it("la segunda caja del día no festeja: la racha no cambió", async () => {
    vi.mocked(closeCashSessionAction).mockResolvedValue({
      success: true,
      data: { session: CERRADA, streak: { previous: 13, current: 13 } },
    });

    await cerrar();

    expect(useStreakCelebration.getState().celebration).toBeNull();
  });

  it("una caja sin cobros no festeja", async () => {
    vi.mocked(closeCashSessionAction).mockResolvedValue({
      success: true,
      data: { session: CERRADA, streak: null },
    });

    await cerrar();

    expect(useStreakCelebration.getState().celebration).toBeNull();
  });

  it("si el cierre falla, muestra el error y no festeja", async () => {
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
    expect(useStreakCelebration.getState().celebration).toBeNull();
  });
});
