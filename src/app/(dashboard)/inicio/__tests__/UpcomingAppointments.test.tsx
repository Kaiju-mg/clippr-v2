import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UpcomingAppointments } from "../_components/UpcomingAppointments";
import { useTimerStore } from "@/store/timerStore";
import type { Appointment, Service } from "@/types";

const SERVICES: Service[] = [
  {
    id: "s1",
    barbershop_id: "b1",
    name: "Corte + barba",
    price: 70000,
    duration_minutes: 45,
    is_active: true,
  },
];

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "a1",
    barbershop_id: "b1",
    user_id: "u1",
    client_name: "Juan Ramírez",
    service_id: "s1",
    // 18:30 UTC = 15:30 en America/Asuncion. Paraguay dejó de mover el
    // reloj en 2024 y quedó fijo en UTC−3, así que no hay que pensar en
    // qué mes es. Se muestra como "15:30": desde la spec 10 las horas van
    // en 24 h (antes `es-PY` las daba en 12, "3:30 p. m.").
    start_time: "2026-09-20T18:30:00.000Z",
    end_time: "2026-09-20T19:15:00.000Z",
    status: "scheduled",
    ...overrides,
  };
}

beforeEach(() => {
  useTimerStore.setState({ timers: [] });
  localStorage.clear();
});

/** El filtro de turnos en curso recién actúa después de rehidratar. */
function empezarBoton() {
  return screen.findByRole("button", { name: /Empezar/ });
}

describe("UpcomingAppointments", () => {
  it("muestra la hora del negocio, el cliente y el nombre del servicio", () => {
    render(
      <UpcomingAppointments
        appointments={[appointment()]}
        services={SERVICES}
      />,
    );

    // Texto exacto: la hora va en 24 h, sin "p. m." (spec 10, ver
    // `formatBusinessTime`).
    expect(screen.getByText("15:30")).toBeInTheDocument();
    expect(screen.getByText("Juan Ramírez")).toBeInTheDocument();
    expect(screen.getByText("Corte + barba")).toBeInTheDocument();
  });

  it("no lista turnos ya cobrados ni cancelados", () => {
    render(
      <UpcomingAppointments
        appointments={[
          appointment({ id: "a1", status: "completed" }),
          appointment({
            id: "a2",
            status: "cancelled",
            client_name: "Diego Ayala",
          }),
        ]}
        services={SERVICES}
      />,
    );

    expect(screen.queryByText("Juan Ramírez")).not.toBeInTheDocument();
    expect(screen.queryByText("Diego Ayala")).not.toBeInTheDocument();
    expect(
      screen.getByText("No tenés turnos agendados para hoy."),
    ).toBeInTheDocument();
  });

  it("aguanta un turno cuyo servicio ya no está en el catálogo", () => {
    render(
      <UpcomingAppointments
        appointments={[appointment({ service_id: "borrado" })]}
        services={SERVICES}
      />,
    );

    expect(screen.getByText("Servicio eliminado")).toBeInTheDocument();
  });

  it("corta a cuatro turnos y ofrece el resto en la agenda", () => {
    const appointments = Array.from({ length: 6 }, (_, index) =>
      appointment({ id: `a${index}`, client_name: `Cliente ${index}` }),
    );

    render(
      <UpcomingAppointments appointments={appointments} services={SERVICES} />,
    );

    expect(screen.getByText("Cliente 3")).toBeInTheDocument();
    expect(screen.queryByText("Cliente 4")).not.toBeInTheDocument();
    expect(screen.getByText("+2 turnos más")).toBeInTheDocument();
  });

  it("si la consulta falló lo dice, en vez de afirmar que no hay turnos", () => {
    render(
      <UpcomingAppointments appointments={[]} services={SERVICES} failed />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar tus turnos de hoy.",
    );
    expect(
      screen.queryByText("No tenés turnos agendados para hoy."),
    ).not.toBeInTheDocument();
  });
});

describe("UpcomingAppointments — empezar el corte", () => {
  it("ofrece Empezar en cada turno agendado", async () => {
    render(
      <UpcomingAppointments
        appointments={[appointment()]}
        services={SERVICES}
      />,
    );

    expect(await empezarBoton()).toBeInTheDocument();
  });

  it("al empezar, el turno sale de la lista y arranca un temporizador", async () => {
    render(
      <UpcomingAppointments
        appointments={[appointment()]}
        services={SERVICES}
      />,
    );

    fireEvent.click(await empezarBoton());

    // El turno se mudó a la lista de temporizadores: no puede seguir acá.
    await waitFor(() =>
      expect(screen.queryByText("Juan Ramírez")).not.toBeInTheDocument(),
    );

    const timers = useTimerStore.getState().timers;
    expect(timers).toHaveLength(1);
    expect(timers[0]).toMatchObject({
      appointmentId: "a1",
      serviceId: "s1",
      label: "Juan Ramírez",
    });
  });

  it("con todos los turnos en curso no dice que no hay turnos", async () => {
    render(
      <UpcomingAppointments
        appointments={[appointment()]}
        services={SERVICES}
      />,
    );

    fireEvent.click(await empezarBoton());

    await waitFor(() =>
      expect(
        screen.getByText("Todos los turnos de hoy están en curso."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("No tenés turnos agendados para hoy."),
    ).not.toBeInTheDocument();
  });

  it("los turnos que no se empezaron siguen en la lista", async () => {
    render(
      <UpcomingAppointments
        appointments={[
          appointment(),
          appointment({
            id: "a2",
            client_name: "Diego Ayala",
            start_time: "2026-09-20T19:15:00.000Z",
          }),
        ]}
        services={SERVICES}
      />,
    );

    const botones = await screen.findAllByRole("button", { name: /Empezar/ });
    fireEvent.click(botones[0]);

    await waitFor(() =>
      expect(screen.queryByText("Juan Ramírez")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Diego Ayala")).toBeInTheDocument();
  });

  it("un turno que ya tiene temporizador no vuelve a aparecer", async () => {
    useTimerStore.getState().startTimer({ appointmentId: "a1" });

    render(
      <UpcomingAppointments
        appointments={[appointment()]}
        services={SERVICES}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByText("Juan Ramírez")).not.toBeInTheDocument(),
    );
  });
});
