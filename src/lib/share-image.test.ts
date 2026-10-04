import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shareOrDownloadImage } from "./share-image";

const PNG = new Blob(["png"], { type: "image/png" });

function stubShare(canShare: boolean, share = vi.fn(async () => {})) {
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: vi.fn(() => canShare),
  });
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });
  return share;
}

describe("shareOrDownloadImage", () => {
  let click: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => "blob:clippr");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    click.mockRestore();
    Reflect.deleteProperty(navigator, "canShare");
    Reflect.deleteProperty(navigator, "share");
  });

  it("con Web Share de archivos, abre el menú del celular con el PNG", async () => {
    const share = stubShare(true);

    const outcome = await shareOrDownloadImage(PNG, "clippr-2026-10-04.png");

    expect(outcome).toBe("shared");
    const [{ files }] = share.mock.calls[0] as unknown as [{ files: File[] }];
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("clippr-2026-10-04.png");
    expect(files[0].type).toBe("image/png");
    expect(click).not.toHaveBeenCalled();
  });

  it("cerrar el menú sin elegir no es un error", async () => {
    stubShare(
      true,
      vi.fn(async () => {
        throw new DOMException("cancelado", "AbortError");
      }),
    );

    await expect(
      shareOrDownloadImage(PNG, "clippr-2026-10-04.png"),
    ).resolves.toBe("cancelled");
  });

  it("si compartir falla de verdad, el error sube", async () => {
    stubShare(
      true,
      vi.fn(async () => {
        throw new DOMException("no", "NotAllowedError");
      }),
    );

    await expect(
      shareOrDownloadImage(PNG, "clippr-2026-10-04.png"),
    ).rejects.toThrow("no");
  });

  it("si el navegador no puede compartir archivos, descarga el PNG", async () => {
    const share = stubShare(false);

    const outcome = await shareOrDownloadImage(PNG, "clippr-2026-10-04.png");

    expect(outcome).toBe("downloaded");
    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    const link = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(link.download).toBe("clippr-2026-10-04.png");
    expect(link.href).toBe("blob:clippr");
  });

  it("sin Web Share en absoluto (escritorio viejo), también descarga", async () => {
    const outcome = await shareOrDownloadImage(PNG, "clippr-2026-10-04.png");
    expect(outcome).toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
  });
});
