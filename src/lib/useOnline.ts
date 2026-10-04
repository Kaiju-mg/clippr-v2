"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

// En el servidor no hay red que medir: se asume conexión, y el cliente
// corrige al hidratar si no la hay.
function getServerSnapshot() {
  return true;
}

/**
 * Estado de red (spec 10, fase 3, paso A): `navigator.onLine` más los eventos
 * `online`/`offline`. Es el "store chico" de la spec: un store externo leído
 * con `useSyncExternalStore`, sin Zustand ni estado propio que sincronizar.
 *
 * `navigator.onLine === false` es confiable (seguro no hay red); `true` sólo
 * dice que hay una interfaz conectada. Alcanza para lo que se usa: no
 * ofrecer cobrar cuando seguro no se puede.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
