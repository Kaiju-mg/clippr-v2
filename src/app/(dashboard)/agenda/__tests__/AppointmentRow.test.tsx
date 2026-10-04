import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppointmentRow } from "../_components/AppointmentRow";
import type { Appointment } from "@/types";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/actions/agenda.actions", () => ({
  completeScheduledAppointmentAction: vi.fn(),
  cancelAppointmentAction: vi.fn(),
}));

import {
  cancelAppointmentAction,
  completeScheduledAppointmentAction,
} from "@/actions/agenda.actions";

const TURNO: Appointment = {
  id: "a1",
  barbershop_id: "b1",
  user_id: "u1",
  client_name: "Lucas Giménez",
  service_id: "s1",
  // 21:30 UTC = 18:30 en Paraguay.
  start_time: "2026-10-03T21:30:00.000Z",
  end_time: "2026-10-03T22:00:00.000Z",
  status: "scheduled",
};

function fila(
  overrides: Partial<Appointment> = {},
  props: { cashSessionId?: string | null; esDiaFuturo?: boolean } = {},
) {
  return render(
    <AppointmentRow
      appointment={{ ...TURNO, ...overrides }}
      serviceName="Corte clásico"
      servicePrice={50000}
      cashSessionId={
        props.cashSessionId === undefined ? "cs1" : props.cashSessionId
      }
      esDiaFuturo={props.esDiaFuturo ?? false}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Una acción que no termina hasta que el test la suelta. Con `useOptimistic`,
 * apenas la acción termina la fila vuelve a lo que traen las props (en la app
 * las actualiza `router.refresh()`, acá mockeado): para mirar el estado
 * optimista sin carreras, la acción tiene que quedar pendiente.
 */
function pendiente() {
  let soltar: () => void = () => {};
  const promesa = new Promise<{ success: true; data: never }>((resolve) => {
    soltar = () => resolve({ success: true, data: undefined as never });
  });
  return { promesa, soltar };
}

describe("AppointmentRow — tema Recibo", () => {
  it("un turno pendiente muestra hora en mono, monto y Cancelar/Cobrar abajo", () => {
    fila();
    const hora = screen.getByText("18:30");
    expect(hora).toHaveClass("font-mono", "tabular-nums");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cobrar" })).toBeEnabled();
    expect(document.querySelector("[data-stamp]")).toBeNull();
  });

  it("lo que ya venía cobrado lleva el sello COBRADO, quieto", () => {
    fila({ status: "completed" });
    const sello = screen.getByText("Cobrado");
    expect(sello).toHaveAttribute("data-stamp");
    expect(sello).not.toHaveClass("animate-stamp-slam");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("la fila cobrada se atenúa, pero el sello no", () => {
    fila({ status: "completed" });
    expect(screen.getByText("Lucas Giménez").parentElement).toHaveClass(
      "opacity-45",
    );
    expect(screen.getByText("Cobrado")).not.toHaveClass("opacity-45");
  });

  it("un walk-in también es cobrado", () => {
    fila({ status: "walkin" });
    expect(screen.getByText("Cobrado")).toHaveAttribute("data-stamp");
  });

  it("al cobrar en pantalla, el sello cae", async () => {
    const accion = pendiente();
    vi.mocked(completeScheduledAppointmentAction).mockReturnValue(
      accion.promesa,
    );
    fila();

    fireEvent.click(screen.getByRole("button", { name: "Cobrar" }));

    const sello = await screen.findByText("Cobrado");
    expect(sello).toHaveClass("animate-stamp-slam");
    expect(completeScheduledAppointmentAction).toHaveBeenCalledWith(
      "a1",
      "cs1",
    );

    accion.soltar();
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("un cancelado va tachado y atenuado, sin sello", () => {
    fila({ status: "cancelled" });
    expect(screen.getByText("Lucas Giménez")).toHaveClass("line-through");
    expect(screen.getByText("Cancelado")).not.toHaveAttribute("data-stamp");
    expect(document.querySelector("[data-stamp]")).toBeNull();
  });

  it("cancelar no se pinta de rojo: el rojo es del sello y de los errores", () => {
    fila();
    const cancelar = screen.getByRole("button", { name: "Cancelar" });
    expect(cancelar.className).not.toMatch(/text-(danger|stamp)/);
  });

  it("al cancelar, la fila pasa a cancelada", async () => {
    const accion = pendiente();
    vi.mocked(cancelAppointmentAction).mockReturnValue(accion.promesa);
    fila();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByText("Cancelado")).toBeInTheDocument();
    expect(screen.getByText("Lucas Giménez")).toHaveClass("line-through");

    accion.soltar();
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("en un día futuro no se cobra", () => {
    fila({}, { esDiaFuturo: true });
    expect(
      screen.queryByRole("button", { name: "Cobrar" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Se cobra el día del turno")).toBeInTheDocument();
  });

  it("sin caja abierta, Cobrar queda deshabilitado y avisa", () => {
    fila({}, { cashSessionId: null });
    expect(screen.getByRole("button", { name: "Cobrar" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Debes abrir tu caja diaria",
    );
  });
});
