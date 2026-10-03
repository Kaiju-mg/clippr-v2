import { describe, expect, it, afterEach, vi } from "vitest";
import { randomId } from "./ids";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * El caso que motivó este módulo: servida por IP con HTTP plano (probar desde
 * un celular en la misma red), la página no es un contexto seguro y
 * `crypto.randomUUID` simplemente no existe. Antes, tocar "Iniciar corte"
 * tiraba un TypeError y no pasaba nada.
 */
function sinRandomUUID() {
  vi.stubGlobal("crypto", {
    getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
  });
}

describe("randomId", () => {
  it("devuelve un UUID v4 válido", () => {
    expect(randomId()).toMatch(UUID_V4);
  });

  it("no repite ids", () => {
    const ids = new Set(Array.from({ length: 500 }, () => randomId()));
    expect(ids.size).toBe(500);
  });

  it("sigue funcionando sin crypto.randomUUID (contexto inseguro)", () => {
    sinRandomUUID();

    expect(crypto.randomUUID).toBeUndefined();
    expect(randomId()).toMatch(UUID_V4);
  });

  it("el respaldo tampoco repite ids", () => {
    sinRandomUUID();

    const ids = new Set(Array.from({ length: 500 }, () => randomId()));
    expect(ids.size).toBe(500);
  });

  it("usa crypto.randomUUID cuando está disponible", () => {
    const randomUUID = vi.fn(() => "11111111-1111-4111-8111-111111111111");
    vi.stubGlobal("crypto", {
      randomUUID,
      getRandomValues: globalThis.crypto.getRandomValues.bind(
        globalThis.crypto,
      ),
    });

    expect(randomId()).toBe("11111111-1111-4111-8111-111111111111");
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});
