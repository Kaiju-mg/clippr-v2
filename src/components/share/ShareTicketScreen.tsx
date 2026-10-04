"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Share } from "lucide-react";
import type { TicketLine } from "@/components/ticket/TicketReceipt";
import { Switch } from "@/components/ui/Switch";
import { shareFontEmbedCSS } from "@/lib/share-fonts";
import { shareOrDownloadImage } from "@/lib/share-image";
import { SHARE_HEIGHT, SHARE_WIDTH, ShareImage } from "./ShareImage";

/** Ancho de la vista previa en pantalla; el alto sale del 9:16. */
const PREVIEW_WIDTH = 240;
const PREVIEW_SCALE = PREVIEW_WIDTH / SHARE_WIDTH;

export interface ShareTicketScreenProps {
  /** "Compartir el día", "Compartir el mes": título y nombre del diálogo. */
  title: string;
  /** Nombre accesible del ticket de la imagen. */
  ticketLabel: string;
  /** Los renglones según el switch "Mostrar montos". */
  linesFor: (showAmounts: boolean) => TicketLine[];
  streakDays: number | null;
  phone: string | null;
  /** Nombre del PNG: `clippr-2026-10-04.png`. */
  fileName: string;
  /** Qué agrega "Mostrar montos" prendido. */
  amountsOnHint: string;
  amountsOffHint: string;
  onBack: () => void;
}

type Aviso =
  { tipo: "error"; texto: string } | { tipo: "info"; texto: string } | null;

/**
 * Pantalla para compartir un ticket en el estado de WhatsApp (spec 10, fase
 * 3; generalizada en la fase 4 para el ticket del mes). Vista previa 9:16 de
 * la imagen, el switch "Mostrar montos" y "Compartir imagen".
 *
 * - El switch arranca **apagado cada vez** y no se recuerda: es estado de
 *   esta pantalla, que se desmonta al volver. Nunca se publica plata por
 *   accidente.
 * - La imagen se genera en el teléfono (`html-to-image`), sin servidor: anda
 *   sin conexión. `html-to-image` se carga recién al tocar el botón, para no
 *   sumarlo al bundle de todas las pantallas.
 */
export function ShareTicketScreen({
  title,
  ticketLabel,
  linesFor,
  streakDays,
  phone,
  fileName,
  amountsOnHint,
  amountsOffHint,
  onBack,
}: ShareTicketScreenProps) {
  const [showAmounts, setShowAmounts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  const lines = linesFor(showAmounts);

  async function handleShare() {
    const node = imageRef.current;
    if (!node) return;
    setBusy(true);
    setAviso(null);
    try {
      const [{ toBlob }, fontEmbedCSS] = await Promise.all([
        import("html-to-image"),
        // Sólo las dos fuentes de la imagen, subset latino: sin esto
        // `html-to-image` incrusta las ~50 `@font-face` de la página (ver
        // `share-fonts.ts`).
        shareFontEmbedCSS(node),
      ]);
      const blob = await toBlob(node, {
        width: SHARE_WIDTH,
        height: SHARE_HEIGHT,
        pixelRatio: 1,
        fontEmbedCSS,
      });
      if (!blob) throw new Error("toBlob devolvió null");

      const outcome = await shareOrDownloadImage(blob, fileName);
      if (outcome === "downloaded") {
        setAviso({
          tipo: "info",
          texto: "La imagen se descargó. Subila a tu estado desde la galería.",
        });
      }
    } catch (error) {
      console.error("ShareTicketScreen:", error);
      setAviso({
        tipo: "error",
        texto: "No se pudo armar la imagen. Probá de nuevo.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="bg-background text-foreground fixed inset-0 z-[60] overflow-y-auto"
    >
      <div className="mx-auto flex max-w-md flex-col gap-3 px-4 pt-4 pb-6">
        <div className="flex items-center gap-2.5">
          <button
            ref={backRef}
            type="button"
            onClick={onBack}
            aria-label="Volver al ticket"
            className="border-line bg-surface-2 grid h-8 w-8 flex-none place-items-center rounded-full border"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <h2 className="text-[17px] font-semibold">{title}</h2>
        </div>

        <div
          className="self-center overflow-hidden rounded-2xl shadow-[0_8px_22px_rgba(0,0,0,0.22)]"
          style={{
            width: PREVIEW_WIDTH,
            height: PREVIEW_WIDTH * (SHARE_HEIGHT / SHARE_WIDTH),
          }}
        >
          <div
            style={{
              transform: `scale(${PREVIEW_SCALE})`,
              transformOrigin: "top left",
            }}
          >
            <ShareImage
              ref={imageRef}
              label={ticketLabel}
              lines={lines}
              streakDays={streakDays}
              phone={phone}
            />
          </div>
        </div>

        <div className="border-line bg-surface-2 flex items-center justify-between gap-3 rounded-[14px] border px-3 py-2.5">
          <div className="flex min-w-0 flex-col">
            <span className="text-[13.5px] font-semibold">Mostrar montos</span>
            <span className="text-muted text-[11.5px]">
              {showAmounts ? amountsOnHint : amountsOffHint}
            </span>
          </div>
          <Switch
            checked={showAmounts}
            onChange={() => setShowAmounts((value) => !value)}
            label="Mostrar montos"
          />
        </div>

        {aviso && (
          <p
            role={aviso.tipo === "error" ? "alert" : "status"}
            className={
              aviso.tipo === "error"
                ? "text-danger text-sm"
                : "text-muted text-sm"
            }
          >
            {aviso.texto}
          </p>
        )}

        <button
          type="button"
          onClick={handleShare}
          disabled={busy}
          className="bg-accent text-accent-contrast flex w-full items-center justify-center gap-2 rounded-[14px] p-3 text-[14.5px] font-semibold transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          <Share size={17} strokeWidth={2} />
          {busy ? "Armando la imagen…" : "Compartir imagen"}
        </button>
      </div>
    </div>
  );
}
