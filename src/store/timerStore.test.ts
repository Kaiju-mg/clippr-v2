import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTimerStore, useTimerStoreHydrated } from "./timerStore";

function timers() {
  return useTimerStore.getState().timers;
}

beforeEach(() => {
  useTimerStore.setState({ timers: [] });
  localStorage.clear();
});

describe("startTimer — walk-in", () => {
  it("arranca un temporizador sin turno asociado", () => {
    const id = useTimerStore.getState().startTimer({ label: "Tinte" });

    expect(timers()).toHaveLength(1);
    expect(timers()[0]).toMatchObject({ id, label: "Tinte" });
    // Sin estos dos campos, el cierre va por el flujo de walk-in de la
    // spec 05 y no por el del turno agendado.
    expect(timers()[0].appointmentId).toBeUndefined();
    expect(timers()[0].serviceId).toBeUndefined();
  });

  it("arranca sin argumentos (el label es opcional)", () => {
    useTimerStore.getState().startTimer();

    expect(timers()).toHaveLength(1);
    expect(timers()[0].label).toBeUndefined();
  });

  it("admite varios walk-ins a la vez", () => {
    useTimerStore.getState().startTimer({ label: "Tinte" });
    useTimerStore.getState().startTimer({ label: "Barba" });

    expect(timers()).toHaveLength(2);
  });
});

describe("startTimer — turno agendado", () => {
  it("guarda el turno y el servicio para poder cobrarlo después", () => {
    const id = useTimerStore.getState().startTimer({
      appointmentId: "a1",
      serviceId: "s1",
      label: "Juan Ramírez",
    });

    expect(timers()[0]).toMatchObject({
      id,
      appointmentId: "a1",
      serviceId: "s1",
      label: "Juan Ramírez",
    });
  });

  it("no crea dos temporizadores para el mismo turno (doble tap)", () => {
    const primero = useTimerStore
      .getState()
      .startTimer({ appointmentId: "a1", serviceId: "s1" });
    const segundo = useTimerStore
      .getState()
      .startTimer({ appointmentId: "a1", serviceId: "s1" });

    expect(segundo).toBe(primero);
    expect(timers()).toHaveLength(1);
  });

  it("dos turnos distintos sí son dos temporizadores", () => {
    useTimerStore.getState().startTimer({ appointmentId: "a1" });
    useTimerStore.getState().startTimer({ appointmentId: "a2" });

    expect(timers()).toHaveLength(2);
  });

  it("el dedupe es por turno, no afecta a los walk-ins", () => {
    useTimerStore.getState().startTimer({ label: "Tinte" });
    useTimerStore.getState().startTimer({ label: "Tinte" });

    expect(timers()).toHaveLength(2);
  });
});

describe("removeTimer", () => {
  it("saca sólo el temporizador pedido", () => {
    const id = useTimerStore.getState().startTimer({ appointmentId: "a1" });
    useTimerStore.getState().startTimer({ appointmentId: "a2" });

    useTimerStore.getState().removeTimer(id);

    expect(timers()).toHaveLength(1);
    expect(timers()[0].appointmentId).toBe("a2");
  });
});

describe("useTimerStoreHydrated — el store sin persistencia (SSR)", () => {
  it("no explota cuando `persist` no existe", () => {
    // En el servidor no hay `localStorage`, y el middleware `persist` de
    // Zustand devuelve el store pelado, sin colgarle la API. Leer
    // `.persist` durante el render tumbó `/inicio` con un 500 el
    // 2026-09-20; este test fija el contrato.
    const store = useTimerStore as unknown as { persist?: unknown };
    const original = store.persist;
    store.persist = undefined;

    try {
      const { result } = renderHook(() => useTimerStoreHydrated());
      expect(result.current).toBe(false);
    } finally {
      store.persist = original;
    }
  });

  it("con persistencia disponible termina hidratando", async () => {
    const { result } = renderHook(() => useTimerStoreHydrated());

    await waitFor(() => expect(result.current).toBe(true));
  });
});
