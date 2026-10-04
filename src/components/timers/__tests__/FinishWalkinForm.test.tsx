import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setOnline } from "@/test/network";
import type { Service } from "@/types";
import type { Timer } from "@/store/timerStore";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/actions/walkin.actions", () => ({
  completeWalkinAction: vi.fn(),
}));

import { completeWalkinAction } from "@/actions/walkin.actions";
import { FinishWalkinForm } from "../FinishWalkinForm";

const SERVICE: Service = {
  id: "s1",
  barbershop_id: "b1",
  name: "Corte clásico",
  price: 50000,
  duration_minutes: 30,
  is_active: true,
};

const TIMER: Timer = { id: "t1", startTime: Date.now() - 60_000 };

function abrir() {
  const onDone = vi.fn();
  render(
    <FinishWalkinForm
      timer={TIMER}
      cashSessionId="cs1"
      services={[SERVICE]}
      onCancel={vi.fn()}
      onDone={onDone}
    />,
  );
  return { onDone };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FinishWalkinForm — sin señal (spec 10, fase 3)", () => {
  it("con señal cobra normalmente", async () => {
    vi.mocked(completeWalkinAction).mockResolvedValue({
      success: true,
      data: {} as never,
    });
    const { onDone } = abrir();

    fireEvent.click(screen.getByRole("button", { name: "Cobrar" }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(screen.queryByText(/sin señal/i)).not.toBeInTheDocument();
  });

  it("sin señal deshabilita 'Cobrar' y dice que todavía no se cobró", () => {
    abrir();
    setOnline(false);

    expect(screen.getByRole("button", { name: "Cobrar" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sin señal · todavía no se cobró",
    );
    // No promete guardar nada: no hay cola offline (paso B).
    expect(screen.getByRole("status")).not.toHaveTextContent(/cuando vuelva/i);
  });

  it("sin señal, ni un submit forzado llega al servidor", () => {
    abrir();
    setOnline(false);

    fireEvent.submit(screen.getByRole("button", { name: "Cobrar" }));

    expect(completeWalkinAction).not.toHaveBeenCalled();
  });

  it("al volver la señal se puede cobrar de nuevo", () => {
    abrir();
    setOnline(false);
    setOnline(true);

    expect(screen.getByRole("button", { name: "Cobrar" })).toBeEnabled();
    expect(screen.queryByText(/sin señal/i)).not.toBeInTheDocument();
  });
});
