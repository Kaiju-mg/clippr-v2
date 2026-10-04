import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Service } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/actions/walkin.actions", () => ({
  completeWalkinAction: vi.fn(),
}));

vi.mock("@/actions/agenda.actions", () => ({
  completeScheduledAppointmentAction: vi.fn(),
}));

import { completeWalkinAction } from "@/actions/walkin.actions";
import { completeScheduledAppointmentAction } from "@/actions/agenda.actions";
import { useTimerStore } from "@/store/timerStore";
import { TimerCard } from "../TimerCard";

const SERVICE: Service = {
  id: "s1",
  barbershop_id: "b1",
  name: "Corte clásico",
  price: 50000,
  duration_minutes: 30,
  is_active: true,
};

/** Arranca un temporizador de verdad en el store y dibuja su tarjeta. */
function arrancar(input: { appointmentId?: string; serviceId?: string } = {}) {
  let id = "";
  act(() => {
    id = useTimerStore.getState().startTimer(input);
  });
  const timer = useTimerStore.getState().timers.find((t) => t.id === id)!;
  render(<TimerCard timer={timer} cashSessionId="cs1" services={[SERVICE]} />);
  return id;
}

const timers = () => useTimerStore.getState().timers;

beforeEach(() => {
  vi.clearAllMocks();
  useTimerStore.setState({ timers: [] });
});

describe("TimerCard — descartar un corte arrancado sin querer", () => {
  it("'Descartar' pide confirmación antes de borrar nada", () => {
    arrancar();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(
      screen.getByText(/¿Descartar este corte\? No se cobra ni se guarda\./),
    ).toBeInTheDocument();
    expect(timers()).toHaveLength(1);
  });

  it("confirmando, el temporizador desaparece sin cobrar ni guardar nada", () => {
    arrancar();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, descartar" }));

    expect(timers()).toHaveLength(0);
    // Nada llega al servidor: no suma cortes, caja, racha ni estadísticas.
    expect(completeWalkinAction).not.toHaveBeenCalled();
    expect(completeScheduledAppointmentAction).not.toHaveBeenCalled();
  });

  it("'Volver' deja el corte corriendo como estaba", () => {
    arrancar();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(timers()).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Finalizar" }),
    ).toBeInTheDocument();
  });

  it("un turno agendado descartado vuelve a 'Lo que viene'", () => {
    arrancar({ appointmentId: "a1", serviceId: "s1" });

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(
      screen.getByText(/El turno vuelve a “Lo que viene”/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sí, descartar" }));
    expect(timers()).toHaveLength(0);
    // El turno sigue agendado: no se canceló ni se cobró.
    expect(completeScheduledAppointmentAction).not.toHaveBeenCalled();
  });

  it("'Finalizar' sigue llevando a cobrar, sin el botón de descartar en el medio", () => {
    arrancar();

    fireEvent.click(screen.getByRole("button", { name: "Finalizar" }));

    expect(screen.getByRole("button", { name: "Cobrar" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Descartar" }),
    ).not.toBeInTheDocument();
  });
});
