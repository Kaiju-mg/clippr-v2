/**
 * Fuentes de la imagen "Compartir el día" (spec 10, fase 3).
 *
 * `html-to-image` incrusta por defecto **todas** las `@font-face` de la
 * página: Inter, IBM Plex Mono y Courier Prime con cada subset (latin,
 * latin-ext, cyrillic, greek, vietnamese…). Son ~50 reglas y ~40 archivos
 * que se bajan, se pasan a base64 y quedan adentro del SVG que el navegador
 * tiene que decodificar: memoria y trabajo de más en un celular de gama
 * media, y más fuentes que tener en caché para poder generar sin señal.
 *
 * La imagen usa sólo dos familias (Inter para el sello y el pie, Courier
 * Prime para el ticket) y texto en castellano, así que alcanza con el subset
 * latino de esas dos. Este módulo arma ese CSS una vez, lo cachea y se lo
 * pasa a `html-to-image` como `fontEmbedCSS`.
 */

export interface FontFaceInfo {
  family: string;
  unicodeRange: string;
  cssText: string;
}

/** Saca las comillas de un nombre de familia: `"Courier Prime"` → `Courier Prime`. */
function unquote(name: string): string {
  return name.trim().replace(/^["']|["']$/g, "");
}

/** Familias que usa de verdad el nodo (la primera de cada `font-family`). */
export function usedFamilies(fontFamilies: Iterable<string>): Set<string> {
  const families = new Set<string>();
  for (const value of fontFamilies) {
    const first = value.split(",")[0];
    if (first) families.add(unquote(first));
  }
  return families;
}

/** ¿El `unicode-range` cubre las letras latinas básicas (U+0041, "A")? */
export function coversBasicLatin(unicodeRange: string): boolean {
  if (!unicodeRange.trim()) return true; // sin rango = cubre todo
  return unicodeRange.split(",").some((part) => {
    const range = part.trim().toUpperCase().replace(/^U\+/, "");
    if (range.includes("?")) {
      const low = parseInt(range.replace(/\?/g, "0"), 16);
      const high = parseInt(range.replace(/\?/g, "F"), 16);
      return low <= 0x41 && 0x41 <= high;
    }
    const [lowHex, highHex = lowHex] = range.split("-");
    const low = parseInt(lowHex, 16);
    const high = parseInt(highHex.replace(/^U\+/, ""), 16);
    return low <= 0x41 && 0x41 <= high;
  });
}

/**
 * De todas las `@font-face` de la página, sólo las de las familias usadas y
 * el subset que cubre el latín básico.
 */
export function pickFontFaces(
  faces: readonly FontFaceInfo[],
  families: Set<string>,
): FontFaceInfo[] {
  return faces.filter(
    (face) =>
      families.has(unquote(face.family)) && coversBasicLatin(face.unicodeRange),
  );
}

/** Todas las `@font-face` de las hojas de estilo de la página (mismo origen). */
function pageFontFaces(): FontFaceInfo[] {
  const faces: FontFaceInfo[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // hoja de otro origen: no se puede leer
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        faces.push({
          family: rule.style.getPropertyValue("font-family"),
          unicodeRange: rule.style.getPropertyValue("unicode-range"),
          cssText: rule.cssText,
        });
      }
    }
  }
  return faces;
}

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Cambia cada `url(...)` de la regla por el archivo en base64. */
async function inlineUrls(cssText: string): Promise<string> {
  const urls = [...cssText.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(
    (match) => match[1],
  );
  let inlined = cssText;
  for (const url of urls) {
    const absolute = new URL(url, document.baseURI).href;
    inlined = inlined.replace(url, await toDataUrl(absolute));
  }
  return inlined;
}

let cache: { key: string; css: Promise<string> } | null = null;

/**
 * CSS de fuentes para `html-to-image`, sólo con lo que usa `node`. Se arma
 * una vez por combinación de familias y queda en memoria: compartir dos
 * veces no vuelve a bajar nada.
 */
export function shareFontEmbedCSS(node: HTMLElement): Promise<string> {
  const families = usedFamilies(
    [node, ...Array.from(node.querySelectorAll<HTMLElement>("*"))].map(
      (element) => getComputedStyle(element).fontFamily,
    ),
  );
  const key = [...families].sort().join("|");
  if (cache?.key === key) return cache.css;

  const css = Promise.all(
    pickFontFaces(pageFontFaces(), families).map((face) =>
      inlineUrls(face.cssText),
    ),
  ).then((rules) => rules.join("\n"));
  // Si falla (sin señal y sin la fuente en caché), que el próximo intento
  // vuelva a probar en vez de quedarse con el error.
  css.catch(() => {
    if (cache?.css === css) cache = null;
  });
  cache = { key, css };
  return css;
}
