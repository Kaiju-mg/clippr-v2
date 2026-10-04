export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Comparte la imagen del día (spec 10, fase 3). Con Web Share nivel 2
 * (`navigator.canShare({ files })`) abre el menú del celular, de donde se
 * elige WhatsApp → Mi estado. Si el navegador no puede compartir archivos
 * (escritorio, Firefox), descarga el PNG.
 *
 * Cerrar el menú sin elegir nada no es un error: vuelve `"cancelled"`.
 */
export async function shareOrDownloadImage(
  blob: Blob,
  fileName: string,
): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    typeof navigator.share === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      throw error;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Darle tiempo al navegador a empezar la descarga antes de liberar la URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
