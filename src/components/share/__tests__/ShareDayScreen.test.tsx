import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { summarizeCash } from "@/lib/cash-summary";
import type { ShareDay } from "@/lib/share-day";

vi.mock("html-to-image", () => ({
  toBlob: vi.fn(),
}));

vi.mock("@/lib/share-image", () => ({
  shareOrDownloadImage: vi.fn(),
}));

vi.mock("@/lib/share-fonts", () => ({
  shareFontEmbedCSS: vi.fn(async () => "@font-face{font-family:Inter}"),
}));

import { toBlob } from "html-to-image";
import { shareOrDownloadImage } from "@/lib/share-image";
import { ShareDayScreen } from "../ShareDayScreen";

const SUMMARY = summarizeCash(50000, [
  { type: "income", category: "service", amount: 50000 },
  { type: "income", category: "service", amount: 70000 },
]);

const SHARE: ShareDay = {
  barbershopName: "Barbería El Poste",
  phone: "0981 123 456",
  cutsByService: [
    { name: "Corte clásico", count: 1 },
    { name: "Corte + barba", count: 1 },
  ],
};

function abrir(overrides: Partial<ShareDay> = {}, streakDays: number | null = 13) {
  const onBack = vi.fn();
  render(
    <ShareDayScreen
      summary={SUMMARY}
      share={{ ...SHARE, ...overrides }}
      // 00:05 UTC del 4 todavía es el sábado 3 en Paraguay.
      closedAt="2026-10-04T00:05:00.000Z"
      barberName="Eduardo Villalba"
      streakDays={streakDays}
      onBack={onBack}
    />,
  );
  return { onBack, imagen: screen.getByRole("region", { name: "Ticket del día" }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ShareDayScreen — compartir el día", () => {
  it("la vista previa es la versión cliente: barbería, cortes por servicio, racha y turnos", () => {
    const { imagen } = abrir();
    expect(imagen).toHaveTextContent("BARBERÍA EL POSTE");
    expect(imagen).toHaveTextContent("Sábado 03/10/2026");
    expect(imagen).toHaveTextContent("Corte clásicox1");
    expect(imagen).toHaveTextContent("CORTES2");
    expect(imagen.querySelector("[data-stamp]")).toHaveTextContent(
      "13 DÍAS DE RACHA",
    );
    expect(imagen).toHaveTextContent("Turnos: 0981 123 456");
    expect(screen.getByText("Hecho con Clippr")).toBeInTheDocument();
  });

  it("con 'Mostrar montos' apagado (el arranque), la imagen no tiene plata", () => {
    const { imagen } = abrir();
    expect(
      screen.getByRole("switch", { name: "Mostrar montos" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(imagen).not.toHaveTextContent("TOTAL");
    expect(imagen.textContent).not.toMatch(/Gs\.|\d{1,3}\.\d{3}/);
  });

  it("prendido, suma el TOTAL de la caja", () => {
    const { imagen } = abrir();
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar montos" }));
    expect(imagen).toHaveTextContent("TOTAL");
    expect(imagen.textContent).toMatch(/170\.000/);
  });

  it("sin teléfono no dibuja 'Turnos', y sin racha no hay sello", () => {
    const { imagen } = abrir({ phone: null }, null);
    expect(imagen).not.toHaveTextContent("Turnos");
    expect(imagen.querySelector("[data-stamp]")).toBeNull();
  });

  it("la imagen no cambia con el tema: lleva sus propios colores de papel", () => {
    abrir();
    const raiz = document.querySelector<HTMLElement>("[data-share-image]")!;
    expect(raiz.style.getPropertyValue("--paper")).toBe("#f3eedf");
    expect(raiz.style.width).toBe("1080px");
    expect(raiz.style.height).toBe("1920px");
  });

  it("'Compartir imagen' arma el PNG de 1080×1920 y lo comparte con el nombre del día", async () => {
    const png = new Blob(["png"], { type: "image/png" });
    vi.mocked(toBlob).mockResolvedValue(png);
    vi.mocked(shareOrDownloadImage).mockResolvedValue("shared");
    abrir();

    fireEvent.click(screen.getByRole("button", { name: /compartir imagen/i }));

    await waitFor(() =>
      expect(shareOrDownloadImage).toHaveBeenCalledWith(
        png,
        "clippr-2026-10-03.png",
      ),
    );
    expect(toBlob).toHaveBeenCalledWith(
      document.querySelector("[data-share-image]"),
      expect.objectContaining({
        width: 1080,
        height: 1920,
        pixelRatio: 1,
        // Sólo las fuentes de la imagen, no las ~50 de la página.
        fontEmbedCSS: "@font-face{font-family:Inter}",
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("si el navegador no comparte archivos, avisa que se descargó", async () => {
    vi.mocked(toBlob).mockResolvedValue(new Blob(["png"]));
    vi.mocked(shareOrDownloadImage).mockResolvedValue("downloaded");
    abrir();

    fireEvent.click(screen.getByRole("button", { name: /compartir imagen/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /se descargó/i,
    );
  });

  it("si no se puede armar la imagen, lo dice y deja reintentar", async () => {
    vi.mocked(toBlob).mockRejectedValue(new Error("fuente sin cargar"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    abrir();

    fireEvent.click(screen.getByRole("button", { name: /compartir imagen/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no se pudo armar la imagen/i,
    );
    expect(shareOrDownloadImage).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /compartir imagen/i }),
    ).toBeEnabled();
  });

  it("'Volver' llama a onBack", () => {
    const { onBack } = abrir();
    fireEvent.click(screen.getByRole("button", { name: "Volver al ticket" }));
    expect(onBack).toHaveBeenCalled();
  });
});
