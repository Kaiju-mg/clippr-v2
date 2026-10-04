import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PATRON_IMPRESORA,
  VIBRATION_KEY,
  isVibrationEnabled,
  setVibrationEnabled,
  vibrate,
} from "./haptics";

function stubVibrate(impl: (pattern: number | number[]) => boolean = () => true) {
  const fn = vi.fn(impl);
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: fn });
  return fn;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "vibrate");
  vi.restoreAllMocks();
});

describe("vibrate", () => {
  it("sin navigator.vibrate (iPhone, escritorio) no hace nada y no rompe", () => {
    expect("vibrate" in navigator).toBe(false);
    expect(() => vibrate(30)).not.toThrow();
    expect(vibrate(PATRON_IMPRESORA)).toBe(false);
  });

  it("con soporte y prendida (el valor por defecto), vibra con el patrón", () => {
    const fn = stubVibrate();
    expect(vibrate(PATRON_IMPRESORA)).toBe(true);
    expect(fn).toHaveBeenCalledWith([40, 60, 40, 60, 40]);
  });

  it("apagada desde /mas, no vibra", () => {
    const fn = stubVibrate();
    setVibrationEnabled(false);
    expect(vibrate(30)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it("si el navegador tira al vibrar, se traga el error", () => {
    stubVibrate(() => {
      throw new Error("bloqueado por el navegador");
    });
    expect(vibrate(30)).toBe(false);
  });
});

describe("preferencia de vibración", () => {
  it("prendida por defecto y guardada por dispositivo", () => {
    expect(isVibrationEnabled()).toBe(true);
    setVibrationEnabled(false);
    expect(localStorage.getItem(VIBRATION_KEY)).toBe("off");
    expect(isVibrationEnabled()).toBe(false);
    setVibrationEnabled(true);
    expect(isVibrationEnabled()).toBe(true);
  });

  it("sin localStorage (modo privado bloqueado) queda prendida y no rompe", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(isVibrationEnabled()).toBe(true);
    expect(() => setVibrationEnabled(false)).not.toThrow();
  });
});
