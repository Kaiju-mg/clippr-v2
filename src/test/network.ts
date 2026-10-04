import { act } from "@testing-library/react";

/**
 * Simula estar con o sin señal: pisa `navigator.onLine` y dispara el evento
 * que escucha `useOnline`. El reset a "con señal" después de cada test está
 * en `vitest.setup.ts`.
 */
export function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
}
