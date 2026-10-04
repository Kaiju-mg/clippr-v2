"use client";

import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/Switch";
import {
  VIBRATION_EVENT,
  VIBRATION_KEY,
  canVibrate,
  isVibrationEnabled,
  setVibrationEnabled,
} from "@/lib/haptics";

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === VIBRATION_KEY) onChange();
  }
  window.addEventListener(VIBRATION_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(VIBRATION_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Interruptor "Vibración" de `/mas` (spec 10, fase 3). Por dispositivo, en
 * `localStorage`, prendido por defecto. Se lee con `useSyncExternalStore`:
 * el servidor no tiene `localStorage` y dibuja "prendido" (el valor por
 * defecto); el cliente corrige al hidratar sin desajuste.
 *
 * En un teléfono que no vibra desde el navegador (iPhone) el switch queda,
 * pero avisa que ahí no hace nada.
 */
export function VibrationSwitch() {
  const enabled = useSyncExternalStore(
    subscribe,
    isVibrationEnabled,
    () => true,
  );
  const supported = useSyncExternalStore(
    () => () => {},
    canVibrate,
    () => true,
  );

  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <div className="flex min-w-0 flex-col">
        <span className="text-[15px]">Vibración</span>
        {!supported && (
          <span className="text-muted text-xs">
            Este teléfono no vibra desde el navegador.
          </span>
        )}
      </div>
      <Switch
        checked={enabled}
        onChange={() => setVibrationEnabled(!enabled)}
        label="Vibración"
      />
    </div>
  );
}
