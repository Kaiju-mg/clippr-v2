import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FinishAppointmentForm } from "../FinishAppointmentForm";
import type { Service } from "@/types";
import type { Timer } from "@/store/timerStore";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/actions/agenda.actions", () => ({
  completeScheduledAppointmentAction: vi.fn(),
}));

import { completeScheduledAppointmentAction } from "@/actions/agenda.actions";

const SERVICE: Service = {
  id: "s1",
  barbershop_id: "b1",
  name: "Corte + barba",
  price: 70000,
  duration_minutes: 45,
  is_active: true,
};

const TIMER: Timer = {
  id: "t1",
  startTime: Date.now() - 60_000,
  label: "Juan Ramírez",
  appointmentId: "a1",
  serviceId: "s1",
};

function setup(
  overrides: {
    cashSessionId?: string | null;
    onDone?: () => void;
    onDiscard?: () => void;
    onCancel?: () => void;
  } = {},
) {
  const props = {
    timer: TIMER,
    cashSessionId: "cs1" as string | null,
    service: SERVICE,
    onCancel: vi.fn(),
    onDone: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides,
  };
  render(<FinishAppointmentForm {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FinishAppointmentForm", () => {
  it("muestra el servicio y el precio del turno, sin preguntar nada", () => {
    setup();

    expect(screen.getByText("Corte + barba")).toBeInTheDocument();
    // No hay select de servicio ni input de cliente: el turno ya los tiene.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sin caja abierta avisa y no intenta cobrar", () => {
    setup({ cashSessionId: null });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Debes abrir tu caja diaria antes de cobrar un corte.",
    );
    expect(
      screen.queryByRole("button", { name: "Cobrar" }),
    ).not.toBeInTheDocument();
    expect(completeScheduledAppointmentAction).not.toHaveBeenCalled();
  });

  it("cobra el turno con su id y la caja abierta", async () => {
    vi.mocked(completeScheduledAppointmentAction).mockResolvedValue({
      success: true,
      data: {} as never,
    });
    const props = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cobrar" }));

    await waitFor(() =>
      expect(completeScheduledAppointmentAction).toHaveBeenCalledWith(
        "a1",
        "cs1",
      ),
    );
    expect(props.onDone).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("ante un error ofrece descartar el temporizador, para no quedar trabado", async () => {
    vi.mocked(completeScheduledAppointmentAction).mockResolvedValue({
      success: false,
      error: "Turno no encontrado o ya fue actualizado.",
    });
    const props = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cobrar" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Turno no encontrado o ya fue actualizado.",
      ),
    );

    // Descartar no pierde plata: si el turno sigue agendado se cobra desde
    // /agenda. Sin este botón, un turno cobrado en otra pestaña dejaba un
    // temporizador imposible de cerrar.
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(props.onDiscard).toHaveBeenCalled();
    expect(props.onDone).not.toHaveBeenCalled();
  });

  it("después de un error se puede reintentar", async () => {
    vi.mocked(completeScheduledAppointmentAction)
      .mockResolvedValueOnce({ success: false, error: "Algo salió mal." })
      .mockResolvedValueOnce({ success: true, data: {} as never });
    const props = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cobrar" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Reintentar" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(props.onDone).toHaveBeenCalled());
    expect(completeScheduledAppointmentAction).toHaveBeenCalledTimes(2);
  });
});
