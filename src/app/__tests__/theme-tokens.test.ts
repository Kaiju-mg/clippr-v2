// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_BROWSER_COLOR, type Theme } from "@/lib/theme";

/**
 * Tokens del tema "Recibo de Barbería" (spec 10, fase 1). Se leen del CSS
 * real (`globals.css`), no de una copia: si alguien cambia un valor, este
 * test es el que avisa que la tabla de la spec, la barra del navegador o el
 * contraste dejaron de cerrar.
 */
const css = readFileSync(
  fileURLToPath(new URL("../globals.css", import.meta.url)),
  "utf8",
);

function block(selector: RegExp): Record<string, string> {
  const match = css.match(selector);
  if (!match) throw new Error(`No se encontró el bloque ${selector}`);
  const tokens: Record<string, string> = {};
  for (const [, name, value] of match[1].matchAll(
    /(--[\w-]+)\s*:\s*([^;]+);/g,
  )) {
    tokens[name] = value.trim();
  }
  return tokens;
}

const THEMES: Record<Theme, Record<string, string>> = {
  light: block(/:root\s*\{([^}]*)\}/),
  dark: block(/\[data-theme="dark"\]\s*\{([^}]*)\}/),
};
const themeInline = block(/@theme inline\s*\{([^}]*)\}/);

/** La tabla de la spec 10, tal cual. */
const SPEC: Record<string, [light: string, dark: string]> = {
  "--background": ["#fffdf6", "#161412"],
  "--surface-2": ["#f4efe4", "#211e1a"],
  "--line": ["#e4ddcd", "#35302a"],
  "--line-strong": ["#c9c0ac", "#4b453c"],
  "--foreground": ["#26231d", "#f1ece1"],
  "--muted": ["#6f685b", "#a69e8f"],
  "--accent": ["#1f3a5f", "#3d6da8"],
  "--accent-strong": ["#16283f", "#5386bf"],
  "--accent-contrast": ["#fffdf6", "#ffffff"],
  "--accent-ink": ["#1f3a5f", "#9dbbe0"],
  "--success": ["#2f6b4f", "#8fd1a8"],
  "--warning": ["#9a5212", "#f2b06b"],
  "--danger": ["#a83b32", "#f0938a"],
  "--stamp": ["#b3261e", "#ef8a7f"],
  "--paper": ["#fffdf6", "#f3eedf"],
  "--paper-ink": ["#26231d", "#26231d"],
  "--paper-rule": ["#8c867a", "#8c867a"],
};

/** Contraste WCAG 2.x entre dos colores `#rrggbb`. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("tokens del tema Recibo (spec 10)", () => {
  it.each(Object.entries(SPEC))(
    "%s tiene los valores de la spec",
    (token, [light, dark]) => {
      expect(THEMES.light[token]).toBe(light);
      expect(THEMES.dark[token]).toBe(dark);
    },
  );

  it("los dos temas definen exactamente los mismos tokens", () => {
    expect(Object.keys(THEMES.dark).sort()).toEqual(
      Object.keys(THEMES.light).sort(),
    );
  });

  it("el sello sobre el papel es siempre el rojo claro, en los dos temas", () => {
    // Fase 2: el ticket redefine `--stamp` con `--paper-stamp` adentro.
    expect(THEMES.light["--paper-stamp"]).toBe("#b3261e");
    expect(THEMES.dark["--paper-stamp"]).toBe("#b3261e");
  });

  it("registra los tokens nuevos como colores de Tailwind", () => {
    for (const name of [
      "stamp",
      "paper",
      "paper-ink",
      "paper-rule",
      "paper-stamp",
    ]) {
      expect(themeInline[`--color-${name}`]).toBe(`var(--${name})`);
    }
  });

  it("registra IBM Plex Mono como font-mono", () => {
    expect(themeInline["--font-mono"]).toBe("var(--font-plex-mono)");
  });

  it("la barra del navegador sigue a --background en los dos temas", () => {
    expect(THEME_BROWSER_COLOR.light).toBe(THEMES.light["--background"]);
    expect(THEME_BROWSER_COLOR.dark).toBe(THEMES.dark["--background"]);
  });

  it("no hay texturas de papel (regla 5): ningún url() en el CSS global", () => {
    expect(css).not.toMatch(/url\(/);
  });
});

describe("contraste AA (4.5:1 para texto)", () => {
  // [texto, fondo]: los pares que la app usa de verdad.
  const TEXT_PAIRS: Array<[string, string]> = [
    ["--muted", "--surface-2"],
    ["--muted", "--background"],
    ["--foreground", "--background"],
    ["--foreground", "--surface-2"],
    ["--accent-contrast", "--accent"],
    ["--accent-ink", "--background"],
    ["--accent-ink", "--surface-2"],
    ["--success", "--surface-2"],
    // El día de gracia de la racha ("Cerrala hoy"), en texto chico.
    ["--warning", "--background"],
    ["--warning", "--surface-2"],
    ["--danger", "--background"],
    ["--danger", "--surface-2"],
    ["--stamp", "--background"],
    ["--stamp", "--surface-2"],
    ["--paper-ink", "--paper"],
  ];

  for (const theme of ["light", "dark"] as const) {
    it.each(TEXT_PAIRS)(`${theme}: %s sobre %s`, (text, bg) => {
      const tokens = THEMES[theme];
      expect(contrast(tokens[text], tokens[bg])).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("el sello se lee sobre el papel del ticket en los dos temas", () => {
    // Sobre el papel, el sello usa siempre el rojo claro (spec 10): el papel
    // es claro en los dos temas.
    for (const theme of ["light", "dark"] as const) {
      const tokens = THEMES[theme];
      expect(
        contrast(tokens["--paper-stamp"], tokens["--paper"]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("el punteado del ticket se distingue del papel (3:1, no es texto)", () => {
    for (const theme of ["light", "dark"] as const) {
      const tokens = THEMES[theme];
      expect(
        contrast(tokens["--paper-rule"], tokens["--paper"]),
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
