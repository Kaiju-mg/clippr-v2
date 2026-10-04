import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamList } from "../_components/TeamList";
import type { User } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/actions/team.actions", () => ({
  createBarberAction: vi.fn(),
  updateBarberAction: vi.fn(),
}));

const member = (overrides: Partial<User>): User => ({
  id: "u2",
  auth_id: "auth-2",
  barbershop_id: "b1",
  role: "barber",
  name: "Matías Benítez",
  level: "pro",
  commission_pct: 40,
  streak_count: 0,
  ...overrides,
});

const TEAM = [
  member({
    id: "u1",
    role: "owner",
    name: "Eduardo Villalba",
    commission_pct: 0,
  }),
  member({}),
];

describe("TeamList — el nivel va en el subtítulo", () => {
  it("con mail (dueño mirando): 'Pro · mail' y 'Dueño · mail'", () => {
    render(
      <TeamList
        team={TEAM}
        isOwner
        emails={{ u1: "edu@elposte.com.py", u2: "matias@elposte.com.py" }}
      />,
    );
    expect(screen.getByText("Pro · matias@elposte.com.py")).toBeInTheDocument();
    expect(screen.getByText("Dueño · edu@elposte.com.py")).toBeInTheDocument();
  });

  it("sin mail (barbero mirando), el subtítulo es sólo el nivel", () => {
    render(<TeamList team={TEAM} isOwner={false} />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("el nivel no va en una píldora aparte", () => {
    render(<TeamList team={TEAM} isOwner emails={{}} />);
    expect(screen.getAllByText("Pro")).toHaveLength(1);
  });

  it("la comisión va en mono y el dueño no muestra 0%", () => {
    render(<TeamList team={TEAM} isOwner />);
    expect(screen.getByText("40%")).toHaveClass("font-mono", "tabular-nums");
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });
});
