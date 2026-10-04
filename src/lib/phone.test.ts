import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("vacío o sólo espacios es 'sin teléfono'", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
  });

  it("acepta los formatos de acá y limpia espacios de más", () => {
    expect(normalizePhone(" 0981 123 456 ")).toBe("0981 123 456");
    expect(normalizePhone("0981   123456")).toBe("0981 123456");
    expect(normalizePhone("+595 981 123-456")).toBe("+595 981 123-456");
    expect(normalizePhone("(021) 555-123")).toBe("(021) 555-123");
  });

  it("rechaza letras, símbolos raros y números demasiado cortos", () => {
    expect(normalizePhone("llamame")).toBeUndefined();
    expect(normalizePhone("0981-ABC-123")).toBeUndefined();
    expect(normalizePhone("0981#123456")).toBeUndefined();
    expect(normalizePhone("12-34")).toBeUndefined();
    expect(normalizePhone("(((--)))")).toBeUndefined();
  });

  it("rechaza lo que el check de la base rechazaría por largo", () => {
    expect(normalizePhone("1".repeat(26))).toBeUndefined();
  });
});
