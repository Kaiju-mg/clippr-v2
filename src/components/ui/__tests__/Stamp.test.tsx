import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stamp } from "../Stamp";

describe("Stamp", () => {
  it("es tinta de sello en mayúsculas", () => {
    render(<Stamp>Cobrado</Stamp>);
    const stamp = screen.getByText("Cobrado");
    expect(stamp).toHaveClass("text-stamp", "uppercase", "border-current");
  });

  it("anima al montar si se le pide, respetando 'reducir movimiento'", () => {
    render(<Stamp animate>Cobrado</Stamp>);
    expect(screen.getByText("Cobrado")).toHaveClass(
      "animate-stamp-slam",
      "motion-reduce:animate-none",
    );
  });

  it("sin animate no cae: aparece quieto", () => {
    render(<Stamp>Agotado</Stamp>);
    expect(screen.getByText("Agotado")).not.toHaveClass("animate-stamp-slam");
  });

  it("sólo anima al montar: cambiar la prop después no lo vuelve a tirar", () => {
    const { rerender } = render(<Stamp animate={false}>Cobrado</Stamp>);
    rerender(<Stamp animate>Cobrado</Stamp>);
    expect(screen.getByText("Cobrado")).not.toHaveClass("animate-stamp-slam");
  });

  it("un re-render no le saca la animación del montaje", () => {
    const { rerender } = render(<Stamp animate>Cobrado</Stamp>);
    const before = screen.getByText("Cobrado");
    rerender(<Stamp animate={false}>Cobrado</Stamp>);
    const after = screen.getByText("Cobrado");
    // El mismo nodo (no se remontó) y la misma clase: el navegador no
    // reinicia una animación CSS que no cambió.
    expect(after).toBe(before);
    expect(after).toHaveClass("animate-stamp-slam");
  });

  it("puede esperar antes de caer", () => {
    render(
      <Stamp animate delayMs={2050}>
        Racha
      </Stamp>,
    );
    expect(screen.getByText("Racha").style.animationDelay).toBe("2050ms");
  });

  it("está torcido entre −6° y −9° según el tamaño", () => {
    const { rerender } = render(<Stamp size="sm">A</Stamp>);
    expect(screen.getByText("A")).toHaveClass("-rotate-6");
    rerender(<Stamp size="md">A</Stamp>);
    expect(screen.getByText("A")).toHaveClass("-rotate-8");
  });
});

describe("Stamp — vibración al caer (fase 3)", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "vibrate");
    vi.useRealTimers();
  });

  function stubVibrate() {
    const fn = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: fn });
    return fn;
  }

  it("vibra una vez cuando el sello cae, después de su demora", () => {
    vi.useFakeTimers();
    const fn = stubVibrate();
    render(
      <Stamp animate haptic={30} delayMs={200}>
        Cobrado
      </Stamp>,
    );
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(30);
  });

  it("un sello quieto (ya venía cobrado) no vibra", () => {
    vi.useFakeTimers();
    const fn = stubVibrate();
    render(<Stamp haptic={30}>Cobrado</Stamp>);
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("si se desmonta antes de caer, no vibra", () => {
    vi.useFakeTimers();
    const fn = stubVibrate();
    const { unmount } = render(
      <Stamp animate haptic={30} delayMs={500}>
        Cobrado
      </Stamp>,
    );
    unmount();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("sin navigator.vibrate cae igual, sin romper", () => {
    vi.useFakeTimers();
    render(
      <Stamp animate haptic={30}>
        Cobrado
      </Stamp>,
    );
    expect(() => vi.advanceTimersByTime(100)).not.toThrow();
    expect(screen.getByText("Cobrado")).toHaveClass("animate-stamp-slam");
  });
});
