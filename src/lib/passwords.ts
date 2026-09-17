import { randomInt } from "node:crypto";

/**
 * Sin caracteres que se confunden al dictarlos o leerlos en un celular
 * (0/O, 1/I/L). Solo mayúsculas y dígitos: se escribe rápido en el teclado
 * del teléfono.
 */
const LETRAS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITOS = "23456789";
const ALFABETO = LETRAS + DIGITOS;

export const TEMPORARY_PASSWORD_LENGTH = 6;

/**
 * Contraseña temporal para un barbero recién creado. Usa `crypto.randomInt`
 * (nunca `Math.random`) y garantiza al menos una letra y un dígito, por si
 * el proyecto de Supabase exige ambos. Solo se usa en el servidor.
 */
export function generateTemporaryPassword(
  length = TEMPORARY_PASSWORD_LENGTH,
): string {
  const chars = [
    LETRAS[randomInt(LETRAS.length)],
    DIGITOS[randomInt(DIGITOS.length)],
  ];
  while (chars.length < length) {
    chars.push(ALFABETO[randomInt(ALFABETO.length)]);
  }

  // Fisher–Yates: que la letra y el dígito garantizados no queden siempre
  // en las dos primeras posiciones.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
