import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/actions/stats.actions", () => ({
  getCurrentRoleAction: vi.fn(),
  getBarberStatsAction: vi.fn(),
  getMonthTicketAction: vi.fn(),
  getStampCardAction: vi.fn(),
  getOwnerStatsAction: vi.fn(),
  getTeamClosuresAction: vi.fn(),
}));

// Los tableros tienen sus propios tests: acá sólo importa cuál se elige y
// si lleva el selector arriba.
vi.mock("../_components/BarberDashboard", () => ({
  BarberDashboard: (props: {
    topSlot?: React.ReactNode;
    firstName: string;
  }) => (
    <div data-testid="personal">
      {props.firstName}
      {props.topSlot}
    </div>
  ),
}));
vi.mock("../_components/OwnerDashboard", () => ({
  OwnerDashboard: (props: { topSlot?: React.ReactNode }) => (
    <div data-testid="negocio">{props.topSlot}</div>
  ),
}));

import {
  getBarberStatsAction,
  getCurrentRoleAction,
  getMonthTicketAction,
  getOwnerStatsAction,
  getStampCardAction,
  getTeamClosuresAction,
} from "@/actions/stats.actions";
import EstadisticasPage from "../page";

const ok = <T,>(data: T) => ({ success: true as const, data });

function rol(role: "owner" | "barber") {
  vi.mocked(getCurrentRoleAction).mockResolvedValue(
    ok({ role, name: role === "owner" ? "Eduardo Villalba" : "Caillu Pérez" }),
  );
}

async function abrir(params: { rango?: string; vista?: string } = {}) {
  render(await EstadisticasPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBarberStatsAction).mockResolvedValue(ok({} as never));
  vi.mocked(getMonthTicketAction).mockResolvedValue(ok(null));
  vi.mocked(getStampCardAction).mockResolvedValue(ok({} as never));
  vi.mocked(getOwnerStatsAction).mockResolvedValue(ok({} as never));
  vi.mocked(getTeamClosuresAction).mockResolvedValue(ok([]));
});

describe("/estadisticas — 'Mi barbería / Yo' del dueño", () => {
  it("el dueño entra a 'Mi barbería' por defecto, con el selector arriba", async () => {
    rol("owner");
    await abrir();

    expect(screen.getByTestId("negocio")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mi barbería" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(getBarberStatsAction).not.toHaveBeenCalled();
  });

  it("en 'Yo' el dueño ve su propio tablero de barbero, sin el del negocio", async () => {
    rol("owner");
    await abrir({ vista: "yo" });

    expect(screen.getByTestId("personal")).toHaveTextContent("Eduardo");
    expect(screen.queryByTestId("negocio")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Yo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Sólo las consultas de lo propio; nada del equipo.
    expect(getBarberStatsAction).toHaveBeenCalled();
    expect(getOwnerStatsAction).not.toHaveBeenCalled();
    expect(getTeamClosuresAction).not.toHaveBeenCalled();
  });

  it("el barbero no tiene selector, y '?vista=yo' a mano no cambia nada", async () => {
    rol("barber");
    await abrir({ vista: "yo" });

    expect(screen.getByTestId("personal")).toHaveTextContent("Caillu");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("un barbero que pide '?vista=barberia' tampoco ve el negocio", async () => {
    rol("barber");
    await abrir({ vista: "barberia" });

    expect(screen.queryByTestId("negocio")).not.toBeInTheDocument();
    expect(getOwnerStatsAction).not.toHaveBeenCalled();
  });
});
