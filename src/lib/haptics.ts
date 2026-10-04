/**
 * Vibración (spec 10, fase 3): un pulso corto al caer el sello de COBRADO y
 * un patrón de "impresora" al imprimirse el ticket del cierre. Sin sonidos
 * (no se acordaron).
 *
 * La preferencia es por dispositivo, así que vive en `localStorage` y no en
 * la base: prendida por defecto, se apaga desde `/mas`. Donde no hay
 * `navigator.vibrate` (iPhone, escritorio) no hace nada y no rompe nada.
 */

export const VIBRATION_KEY = "clippr-vibracion";
/** Evento propio para que el switch se entere de cambios en la misma pestaña. */
export const VIBRATION_EVENT = "clippr-vibracion-change";

/** El golpe del sello de COBRADO. */
export const PULSO_SELLO = 30;
/** Los renglones saliendo de la impresora del cierre. */
export const PATRON_IMPRESORA = [40, 60, 40, 60, 40];

export function canVibrate(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
  );
}

export function isVibrationEnabled(): boolean {
  try {
    return localStorage.getItem(VIBRATION_KEY) !== "off";
  } catch {
    // Modo privado o storage bloqueado: se queda con el valor por defecto.
    return true;
  }
}

export function setVibrationEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(VIBRATION_KEY, enabled ? "on" : "off");
  } catch {
    // Sin storage la preferencia no sobrevive a un F5; no es grave.
  }
  window.dispatchEvent(new Event(VIBRATION_EVENT));
}

/** Vibra si se puede y si el barbero no la apagó. Nunca tira. */
export function vibrate(pattern: number | number[]): boolean {
  if (!canVibrate() || !isVibrationEnabled()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
