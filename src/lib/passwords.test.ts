import { describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  TEMPORARY_PASSWORD_LENGTH,
} from "./passwords";

describe("generateTemporaryPassword", () => {
  it("genera 6 caracteres sin letras ni dígitos ambiguos", () => {
    for (let i = 0; i < 500; i++) {
      const password = generateTemporaryPassword();
      expect(password).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
      expect(password).toMatch(/^[A-HJKMNP-Z2-9]+$/);
    }
  });

  it("siempre incluye al menos una letra y un dígito", () => {
    for (let i = 0; i < 500; i++) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
    }
  });

  it("no repite contraseñas entre llamadas", () => {
    const passwords = new Set(
      Array.from({ length: 200 }, () => generateTemporaryPassword()),
    );
    expect(passwords.size).toBe(200);
  });
});
