import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * El ícono y la pantalla de arranque (spec 10, fase 5), contra los archivos
 * reales de `public/`: si alguien cambia el manifest o reemplaza un PNG por
 * uno del tamaño equivocado, falla acá y no en el celular de un barbero.
 */
// Vitest corre desde la raíz del repo.
const publicDir = join(process.cwd(), "public") + "/";

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

const manifest = JSON.parse(
  readFileSync(`${publicDir}manifest.json`, "utf8"),
) as {
  background_color: string;
  theme_color: string;
  start_url: string;
  icons: ManifestIcon[];
};

/** Ancho, alto y si tiene canal alfa, leídos del encabezado IHDR del PNG. */
function pngInfo(path: string) {
  const bytes = readFileSync(path);
  const firma = bytes.subarray(0, 8).toString("hex");
  const colorType = bytes[25];
  return {
    esPng: firma === "89504e470d0a1a0a",
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    // 4 = gris con alfa, 6 = RGBA.
    conAlfa: colorType === 4 || colorType === 6,
  };
}

describe("manifest de la PWA (spec 10, fase 5)", () => {
  it("fondo y barra color papel: la pantalla de arranque es el poste sobre papel", () => {
    expect(manifest.background_color).toBe("#fffdf6");
    expect(manifest.theme_color).toBe("#fffdf6");
    expect(manifest.start_url).toBe("/inicio");
  });

  it("192 y 512 normales, y un maskable aparte (no 'any maskable')", () => {
    const resumen = manifest.icons.map((icon) => [icon.sizes, icon.purpose]);
    expect(resumen).toEqual([
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ]);
  });

  it.each(manifest.icons.map((icon) => [icon.src, icon] as const))(
    "%s existe y mide lo que dice el manifest",
    (_src, icon) => {
      const path = `${publicDir}${icon.src.replace(/^\//, "")}`;
      expect(existsSync(path)).toBe(true);
      const info = pngInfo(path);
      const [width, height] = icon.sizes.split("x").map(Number);
      expect(info.esPng).toBe(true);
      expect(icon.type).toBe("image/png");
      expect([info.width, info.height]).toEqual([width, height]);
    },
  );
});

describe("apple-touch-icon", () => {
  it("180×180 y sin transparencia (iOS redondea las esquinas solo)", () => {
    const info = pngInfo(`${publicDir}icons/apple-touch-icon.png`);
    expect(info).toEqual({
      esPng: true,
      width: 180,
      height: 180,
      conAlfa: false,
    });
  });
});
