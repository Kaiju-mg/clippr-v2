"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { StreakStamp } from "@/components/ticket/StreakStamp";
import {
  TicketReceipt,
  type TicketLine,
} from "@/components/ticket/TicketReceipt";

/** Tamaño del PNG: 9:16, el del estado de WhatsApp. */
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1920;

/** El ticket mide 250px y se agranda hasta ~900px de los 1080. */
const MAX_SCALE = 3.6;
/** Alto disponible para el ticket, dejando aire arriba y el pie abajo. */
const ALTO_DISPONIBLE = 1480;

/**
 * La imagen es un objeto, como el ticket (regla 4 de la spec 10): no cambia
 * con el tema. Por eso los colores van fijos acá y pisan los tokens del
 * papel, que en claro y en oscuro son distintos.
 */
const PAPER_VARS = {
  "--paper": "#f3eedf",
  "--paper-ink": "#26231d",
  "--paper-rule": "#8c867a",
  "--paper-stamp": "#b3261e",
} as CSSProperties;

/** Fondo carbón con las rayas del poste muy tenues (muestrario, ×4,7). */
const FONDO: CSSProperties = {
  backgroundColor: "#161412",
  backgroundImage:
    "repeating-linear-gradient(-45deg, rgba(214,40,40,.07) 0 66px, transparent 66px 104px, rgba(61,109,168,.07) 104px 170px, transparent 170px 208px)",
};

interface ShareDayImageProps {
  lines: readonly TicketLine[];
  /** Días de racha para el sello; null o 0, sin sello. */
  streakDays: number | null;
  /** "Turnos: …" al pie del ticket; null, no se dibuja. */
  phone: string | null;
  ref?: Ref<HTMLDivElement>;
}

/**
 * La imagen de "Compartir el día" (spec 10, fase 3), a tamaño real: 1080 ×
 * 1920. La misma pieza es la vista previa (achicada con `transform` por quien
 * la contiene) y lo que `html-to-image` convierte en PNG, así lo que se ve es
 * exactamente lo que se publica.
 *
 * Sólo de presentación: los renglones llegan armados (`shareTicketLines`).
 */
export function ShareDayImage({
  lines,
  streakDays,
  phone,
  ref,
}: ShareDayImageProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(MAX_SCALE);

  // Un día con muchos servicios distintos alarga el ticket: se achica para
  // que entre siempre en los 1920px. `offsetHeight` no mide el `transform`.
  useLayoutEffect(() => {
    const alto = ticketRef.current?.offsetHeight;
    if (alto) setScale(Math.min(MAX_SCALE, ALTO_DISPONIBLE / alto));
  }, [lines, streakDays, phone]);

  const footer = (
    <>
      {streakDays !== null && streakDays > 0 && (
        <>
          <hr className="border-paper-rule my-[5px] border-0 border-t border-dashed" />
          <div className="flex justify-center pt-1.5 pb-1">
            <StreakStamp days={streakDays} />
          </div>
        </>
      )}
      {phone && <p className="m-0 pt-1 text-center">Turnos: {phone}</p>}
    </>
  );

  return (
    <div
      ref={ref}
      data-share-image=""
      style={{
        ...PAPER_VARS,
        ...FONDO,
        width: SHARE_WIDTH,
        height: SHARE_HEIGHT,
      }}
      className="relative flex flex-col items-center justify-center overflow-hidden"
    >
      <div
        ref={ticketRef}
        style={{ transform: `scale(${scale})` }}
        className="w-[250px] pb-[9px]"
      >
        <TicketReceipt
          label="Ticket del día"
          lines={lines}
          footer={footer}
          className="shadow-[0_6px_16px_rgba(0,0,0,0.3)]"
        />
      </div>
      <span className="absolute bottom-[120px] font-sans text-[34px] font-semibold tracking-[0.14em] text-[#a69e8f] uppercase">
        Hecho con Clippr
      </span>
    </div>
  );
}
