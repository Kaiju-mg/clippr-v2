"use client";

import { useState, type ChangeEvent } from "react";

const FORMATO_MILES = new Intl.NumberFormat("es-PY");

function soloDigitos(value: string): string {
  return value.replace(/\D/g, "");
}

function quitarCerosALaIzquierda(digitos: string): string {
  return digitos.replace(/^0+(?=\d)/, "");
}

function formatearConPuntosDeMiles(digitos: string): string {
  return digitos ? FORMATO_MILES.format(Number(digitos)) : "";
}

/**
 * Monto en guaraníes para un `<input type="text" inputMode="numeric">` con
 * separador de miles en vivo (ver docs/decisiones.md 2026-09-15). Se sacó de
 * `OpenCashView` para reusarlo en los movimientos de caja (spec 07).
 *
 * `digits` son solo dígitos, sin puntos: lo que se convierte a número para el
 * Server Action. Los puntos se agregan al mostrarlo (`formatted`), nunca se
 * guardan en el estado.
 */
export function useAmountInput() {
  const [digits, setDigits] = useState("");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const cursorPos = input.selectionStart ?? input.value.length;
    const digitosAntesDelCursor = soloDigitos(
      input.value.slice(0, cursorPos),
    ).length;

    const nuevosDigitos = quitarCerosALaIzquierda(soloDigitos(input.value));
    setDigits(nuevosDigitos);

    // Los puntos de miles pueden aparecer/desaparecer con cada tecla y
    // correr el cursor (React re-renderiza el value ya formateado) — lo
    // recalculamos contando cuántos dígitos había antes del cursor y
    // ubicándolo después de esa misma cantidad de dígitos en el texto ya
    // formateado, en vez de dejar que salte al final en cada tecla.
    requestAnimationFrame(() => {
      const formateado = formatearConPuntosDeMiles(nuevosDigitos);
      let nextCursor = 0;
      if (digitosAntesDelCursor > 0) {
        let digitosVistos = 0;
        nextCursor = formateado.length;
        for (let i = 0; i < formateado.length; i++) {
          if (/\d/.test(formateado[i])) digitosVistos++;
          if (digitosVistos === digitosAntesDelCursor) {
            nextCursor = i + 1;
            break;
          }
        }
      }
      input.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return {
    digits,
    formatted: formatearConPuntosDeMiles(digits),
    handleChange,
    reset: () => setDigits(""),
  };
}
