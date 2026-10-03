import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StreakCelebration } from "../StreakCelebration";
import { useStreakCelebration } from "@/store/streakCelebrationStore";

function abrir(previous: number, current: number, finalBalance = 530000) {
  act(() => {
    useStreakCelebration.getState().show({ previous, current, finalBalance });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  useStreakCelebration.setState({ celebration: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("StreakCelebration — la hoja del poste al cerrar la caja", () => {
  it("no muestra nada si no hay nada que festejar", () => {
    render(<StreakCelebration />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("arranca en el número anterior y después cae el nuevo", () => {
    render(<StreakCelebration />);
    abrir(12, 13);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
  });

  it("recuerda el saldo del cierre y cuál es el día de mañana", () => {
    render(<StreakCelebration />);
    abrir(12, 13);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/Caja cerrada con/);
    expect(dialog).toHaveTextContent("530.000");
    expect(dialog).toHaveTextContent("Mañana sumás el día 14.");
  });

  it("una racha que arranca de cero dice 'Racha nueva'", () => {
    render(<StreakCelebration />);
    abrir(0, 1);
    expect(screen.getByText("Racha nueva")).toBeInTheDocument();
  });

  it("el poste gira rápido durante el festejo y después frena", () => {
    const { container } = render(<StreakCelebration />);
    abrir(12, 13);
    const pole = () => container.ownerDocument.querySelector("[data-tier]");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    const rapido = pole()?.className;

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(pole()?.className).not.toBe(rapido);
  });

  it("se cierra con 'Listo'", () => {
    render(<StreakCelebration />);
    abrir(12, 13);

    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    expect(useStreakCelebration.getState().celebration).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("se cierra con Escape", () => {
    render(<StreakCelebration />);
    abrir(12, 13);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useStreakCelebration.getState().celebration).toBeNull();
  });
});
