import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// `next/font` sólo funciona compilado por Next (SWC); en Vitest se llama la
// función tal cual y explota. Cada fuente devuelve una clase y una variable
// fijas, que alcanzan para renderizar los componentes que la usan.
vi.mock("next/font/google", () => {
  const font = (name: string) => () => ({
    className: `font-${name}`,
    variable: `--font-${name}`,
    style: { fontFamily: name },
  });
  return {
    Inter: font("inter"),
    IBM_Plex_Mono: font("plex-mono"),
    Courier_Prime: font("courier-prime"),
  };
});
