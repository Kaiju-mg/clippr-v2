import { describe, expect, it } from "vitest";
import {
  coversBasicLatin,
  pickFontFaces,
  usedFamilies,
  type FontFaceInfo,
} from "./share-fonts";

const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+2000-206F";
const LATIN_EXT = "U+0100-02BA, U+02BD-02C5, U+1E00-1E9F";
const CYRILLIC = "U+0301, U+0400-045F, U+0490-0491";

function face(family: string, unicodeRange: string): FontFaceInfo {
  return {
    family,
    unicodeRange,
    cssText: `@font-face { font-family: ${family}; }`,
  };
}

describe("usedFamilies", () => {
  it("se queda con la primera familia de cada font-family, sin comillas", () => {
    expect(
      usedFamilies([
        'Inter, "Inter Fallback", system-ui, sans-serif',
        '"Courier Prime", "Courier Prime Fallback"',
        "Inter",
      ]),
    ).toEqual(new Set(["Inter", "Courier Prime"]));
  });
});

describe("coversBasicLatin", () => {
  it("el subset latin sí; latin-ext y cyrillic no", () => {
    expect(coversBasicLatin(LATIN)).toBe(true);
    expect(coversBasicLatin(LATIN_EXT)).toBe(false);
    expect(coversBasicLatin(CYRILLIC)).toBe(false);
  });

  it("sin unicode-range cubre todo", () => {
    expect(coversBasicLatin("")).toBe(true);
  });

  it("entiende comodines (U+00??)", () => {
    expect(coversBasicLatin("U+00??")).toBe(true);
    expect(coversBasicLatin("U+04??")).toBe(false);
  });
});

describe("pickFontFaces", () => {
  it("de las ~50 reglas de la página, sólo el latin de las familias usadas", () => {
    const faces = [
      face('"Courier Prime"', LATIN),
      face('"Courier Prime"', LATIN_EXT),
      face("Inter", LATIN),
      face("Inter", CYRILLIC),
      face('"IBM Plex Mono"', LATIN),
    ];

    const picked = pickFontFaces(faces, new Set(["Inter", "Courier Prime"]));

    expect(picked.map((f) => [f.family, f.unicodeRange])).toEqual([
      ['"Courier Prime"', LATIN],
      ["Inter", LATIN],
    ]);
  });
});
